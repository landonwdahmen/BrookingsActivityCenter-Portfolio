const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { hashPassword, verifyPassword, isPasswordHash } = require('./auth');
const { Pool } = require('pg');
const path = require('path');
const { roomFields, validDate, validateEvent, coveredShifts } = require('./event-rules');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize Express app
const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

// Shared local-development configuration with Docker Compose.
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'bac_demo',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.POSTGRES_DB || 'bac_demo',
  password: process.env.POSTGRES_PASSWORD || 'local-demo-only',
  port: Number(process.env.DB_PORT || 5432),
});

// Fail closed instead of using a built-in secret or MemoryStore.
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
  throw new Error('Set SESSION_SECRET to a random value of at least 32 characters. See .env.example.');
}
const secureCookie = process.env.SESSION_COOKIE_SECURE === 'true';
if (process.env.NODE_ENV === 'production' && !secureCookie) {
  throw new Error('Production requires SESSION_COOKIE_SECURE=true and HTTPS.');
}
// Enable only behind exactly one trusted reverse proxy that overwrites forwarding headers.
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 100 }));

// Only public assets/pages are static. Never mount the HTML directory.
for (const directory of ['css', 'images']) {
  app.use('/' + directory, express.static(path.join(__dirname, directory), { dotfiles: 'deny', index: false }));
}
for (const file of ['script.js', 'admin.js', 'employeeScript.js', 'viewSchedule.js', 'calendar.js']) {
  app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
}
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
for (const file of ['form.html', 'login.html']) {
  app.get(['/' + file, '/html/' + file], (req, res) => res.sendFile(path.join(__dirname, 'html', file)));
}
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'html/login.html')));

app.use(session({
  name: 'bac.sid',
  secret,
  store: new PgSession({
    pool, tableName: 'user_sessions', createTableIfMissing: true,
    errorLog: () => console.error('Session store error'),
  }),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: secureCookie, maxAge: 8 * 60 * 60 * 1000 },
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Browser defense for authentication/state changes. Non-browser clients may omit
// Origin; SameSite cookies remain an additional boundary, not a CSRF token system.
app.use(['/login', '/logout', '/create_employee', '/submit_availability'], (req, res, next) => {
  if (req.method === 'POST') {
    const origin = req.get('origin');
    if (req.get('sec-fetch-site') === 'cross-site' ||
        (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: 'Cross-origin request denied' });
    }
  }
  next();
});

// Reload identity/role from PostgreSQL; never trust a browser role or userId.
async function requireEmployee(req, res, next) {
  try {
    if (req.session.employeeId) {
      const result = await pool.query('SELECT id, username, is_admin, job FROM employees WHERE id = $1', [req.session.employeeId]);
      if (result.rows.length) {
        req.employee = result.rows[0];
        return next();
      }
    }
    if (req.path.toLowerCase().endsWith('.html')) return res.redirect('/login.html');
    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) { next(error); }
}
function requireAdmin(req, res, next) {
  if (!req.employee.is_admin) return res.status(403).json({ error: 'Administrator required' });
  next();
}
for (const file of ['employee.html', 'viewSchedule.html', 'admin.html']) {
  const guards = file === 'admin.html' ? [requireEmployee, requireAdmin] : [requireEmployee];
  app.get(['/' + file, '/html/' + file], ...guards, (req, res) => res.sendFile(path.join(__dirname, 'html', file)));
}

// No frontend consumes this historical endpoint; restrict it to admins and omit contact data.
app.get('/Eventschedule', requireEmployee, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT event_name, event_date, event_time, event_duration FROM eventinfo WHERE event_date >= CURRENT_DATE');
    res.json(result.rows);
  } catch (error) { next(error); }
});

//create the eventInfo Table
const createEventInfoTable = `
  CREATE TABLE IF NOT EXISTS eventinfo (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    party_size INTEGER NOT NULL,
    event_duration INTEGER NOT NULL,
    event_name VARCHAR(255) UNIQUE NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    description_info VARCHAR(255) NOT NULL,
    cateringCheckbox BOOLEAN NOT NULL DEFAULT FALSE,
    equipmentCheckbox BOOLEAN NOT NULL DEFAULT FALSE,
    cooksNeeded INTEGER NOT NULL,
    staffNeeded INTEGER NOT NULL
  )
`;

// Create employees table
const createEmployeesTable = `
  CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    job VARCHAR(100) NOT NULL
  )
`;

const createAvailabilityTable = `
CREATE TABLE IF NOT EXISTS availability (
    user_id INTEGER NOT NULL,
    username VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    SHIFT_1 VARCHAR(50),
    SHIFT_2 VARCHAR(50),
    SHIFT_3 VARCHAR(50),
    job VARCHAR(100) NOT NULL
)
`;

// Create sequence for id column
const createSequence = `
  CREATE SEQUENCE IF NOT EXISTS employees_id_seq;
`;

// Public academic demo credentials are hashed before any database insertion.
const demoEmployees = [
  ['Johnny', '123', true, 'admin'], ['Jacob', '456', true, 'admin'],
  ['Kyle', '789', true, 'admin'], ['Carter', '000', true, 'admin'],
  ['Carters', 'Mom', false, 'cook'], ['Tom', 'isCool', false, 'cook'],
  ['Jack', 'abc', false, 'Event Staff'], ['Henry', 'abc123', false, 'cook'],
  ['Jen', '123', false, 'cook'], ['Ken', '567', false, 'Event Staff'],
];

const alterAvail = `
ALTER TABLE availability ADD CONSTRAINT unique_username_date UNIQUE (username, date);
`;

//query for inserting mock availability data
const insertAvailability = `
  INSERT INTO availability (user_id, username, date, SHIFT_1, SHIFT_2, SHIFT_3, job)
  VALUES 
  ('5','Carters', '2024-04-13', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-14', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-15', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-16', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-17', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-18', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-19', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-20', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-21', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-22', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-23', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-24', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-25', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-26', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-27', 'Available', 'Not Available', 'Available', 'cook'),
  ('5','Carters', '2024-04-29', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-04-30', 'Available', 'Not Available', 'Available', 'cook'),  
  ('5','Carters', '2024-05-01', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-02', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-03', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-04', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-05', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-06', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-07', 'Available', 'Not Available', 'Available', 'cook'), 
  ('5','Carters', '2024-05-08', 'Available', 'Not Available', 'Available', 'cook'), 

  ('6','Tom', '2024-04-13', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-14', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-15', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-16', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-17', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-18', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-19', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-20', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-21', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-22', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-23', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-24', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-25', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-26', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-27', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-28', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-29', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-04-30', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-01', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-02', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-03', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-04', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-05', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-06', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-07', 'Available', 'Not Available', 'Available', 'cook'),
  ('6','Tom', '2024-05-08', 'Available', 'Not Available', 'Available', 'cook'),

    ('9','Jen',  '2024-04-13', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-14', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-15', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-16', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-17', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-18', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-19', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',  '2024-04-20', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-21', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-22', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-23', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-24', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-25', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-26', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-27', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-28', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-29', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-04-30', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-01', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-02', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-03', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-04', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-05', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-06', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-07', 'Available', 'Not Available', 'Available', 'cook'),
    ('9','Jen',   '2024-05-08', 'Available', 'Not Available', 'Available', 'cook'),

    ('8','Henry',  '2024-04-13', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-14', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-15', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-16', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-17', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-18', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-19', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',  '2024-04-20', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-21', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-22', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-23', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-24', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-25', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-26', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-27', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-28', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-29', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-04-30', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-01', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-02', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-03', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-04', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-05', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-06', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-07', 'Available', 'Not Available', 'Available', 'cook'),
    ('8','Henry',   '2024-05-08', 'Available', 'Not Available', 'Available', 'cook'),

    ('7','Jack',  '2024-04-13', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-14', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-15', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-16', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-17', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-18', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-19', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',   '2024-04-20', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-21', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-22', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-23', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-24', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-25', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-26', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-27', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-28', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-29', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-04-30', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-01', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-02', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-03', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-04', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-05', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-06', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-07', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('7','Jack',    '2024-05-08', 'Available', 'Not Available', 'Available', 'Event Staff'),

    ('10','Ken',  '2024-04-13', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-14', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-15', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-16', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-17', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-18', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-19', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',   '2024-04-20', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-21', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-22', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-23', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-24', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-25', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-26', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-27', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-28', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-29', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-04-30', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-01', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-02', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-03', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-04', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-05', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-06', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-07', 'Available', 'Not Available', 'Available', 'Event Staff'),
    ('10','Ken',    '2024-05-08', 'Available', 'Not Available', 'Available', 'Event Staff')
    ON CONFLICT (username, date) DO NOTHING
  `;

//query for mock data on events
const eventsTestData = `
  INSERT INTO eventinfo (name, email, phone, party_size, event_duration, event_name, event_date, event_time, description_info, cateringCheckbox, equipmentCheckbox, cooksNeeded, staffNeeded)
  VALUES ('John Doe', 'johnDoe@example.com', '111-111-1111', 10, 3, 'Birthday Party', '2024-04-20', '10:00:00', 'Celebrating my sons birthday', 'true', 'false', 1, 2),
  ('Jane Smith', 'janeSmith@example.com', '222-222-2222', 20, 2, 'Wedding Reception', '2024-04-21', '14:00:00', 'Post Wedding party - getting turnt', 'true', 'false', 1, 2),
  ('Alice Johnson', 'aliceJohnson@example.com', '333-333-3333', 52, 4, 'Baby Shower', '2024-04-22', '11:00:00', 'I am having a kid and want gifts', 'false', 'true', 2, 3), 
  ('Bob Brown', 'bobBrown@example.com', '444-444-4444', 300, 3, 'Corporate Meeting', '2024-04-23', '15:00:00', 'Corporate meeting for BAC', 'true', 'false', 6, 8),
  ('Emma White', 'emmaWhite@example.com', '555-555-5555', 250, 2, 'Family Reunion', '2024-04-24', '12:00:00', 'It is the annual family reunion for the White family', 'true', 'false', 5, 2),
  ('David Green', 'davidGreen@example.com', '666-666-6666', 25, 5, 'Team Building', '2024-04-25', '16:00:00', 'Team building event for John Deer', 'false', 'true', 1, 2),
  ('Grace Parker', 'graceParker@example.com', '777-777-7777', 20, 3, 'Product Launch', '2024-04-26', '10:00:00', 'Secret product launch', 'false', 'false', 1, 2),
  ('Henry Adams', 'henryAdams@example.com', '888-888-8888', 15, 4, 'Conference', '2024-04-27', '14:00:00', 'Meeting up to build knowledge and share ideas', 'true', 'false', 1, 2),
  ('Olivia Martin', 'oliviaMartin@example.com', '999-999-9999', 12, 2, 'Networking Event', '2024-04-28', '11:00:00', 'Building bonds from students looking for jobs', 'false', 'false', 0, 2),
  ('Michael Wilson', 'michaelWilson@example.com', '101-101-1010', 18, 3, 'Seminar', '2024-04-29', '15:00:00', 'Informative speech', 'false', 'true', 0, 2)
  ON CONFLICT (event_name) DO NOTHING;
`;

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(createEventInfoTable);
    // Additive storage for controls already present in the academic event form.
    await client.query(`ALTER TABLE eventinfo
      ADD COLUMN IF NOT EXISTS rooms TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS chairs_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tables_amount INTEGER NOT NULL DEFAULT 0`);
    await client.query(eventsTestData);
    await client.query(createEmployeesTable);
    await client.query(createSequence);
    await client.query('ALTER TABLE employees ALTER COLUMN password TYPE TEXT');
    const accounts = await client.query('SELECT id, password FROM employees FOR UPDATE');
    const legacy = accounts.rows.filter(row => !isPasswordHash(row.password));
    if (legacy.length && process.env.MIGRATE_LEGACY_PASSWORDS !== 'true') {
      const error = new Error('Legacy passwords require explicit conversion');
      error.code = 'LEGACY_PASSWORDS_REQUIRE_OPT_IN';
      throw error;
    }
    for (const account of legacy) {
      await client.query('UPDATE employees SET password = $1 WHERE id = $2', [await hashPassword(account.password), account.id]);
    }
    for (const [username, password, admin, job] of demoEmployees) {
      const existing = await client.query('SELECT id FROM employees WHERE username = $1', [username]);
      if (!existing.rows.length) {
        await client.query('INSERT INTO employees (username, password, is_admin, job) VALUES ($1, $2, $3, $4)', [username, await hashPassword(password), admin, job]);
      }
    }
    await client.query(createAvailabilityTable);
    const checkConstraintQuery = `
  SELECT constraint_name
  FROM information_schema.table_constraints
  WHERE constraint_type = 'UNIQUE' AND table_name = 'availability' AND constraint_name = 'unique_username_date'
`;
    const checkResult = await client.query(checkConstraintQuery);
    if (checkResult.rows.length === 0) {
      // Create the constraint
      await client.query(alterAvail);
    } else {
    }

    await client.query(insertAvailability);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


app.post('/submit_form', async (req, res) => {
  const errorMessage = validateEvent(req.body);
  if (errorMessage) return res.status(400).send(errorMessage);
  try {
    const body = req.body;
    const catering = body.cateringCheckbox === 'yes';
    const equipment = body.equipmentCheckbox === 'yes';
    const partySize = Number(body.partySize);
    // Preserve the original academic formulas; only correct Yes/No interpretation.
    const cooksNeeded = catering ? Math.ceil(partySize / 50) : 0;
    const staffNeeded = 2 + Math.ceil(partySize / 50);
    const rooms = roomFields.filter(field => body[field] === 'on' || body[field] === true);
    await pool.query(`INSERT INTO eventinfo
      (name, email, phone, party_size, event_duration, event_name, event_date, event_time,
       description_info, cateringcheckbox, equipmentcheckbox, cooksneeded, staffneeded,
       rooms, chairs_amount, tables_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [
      body.contactName.trim(), body.contactEmail.trim(), body.contactPhone.trim(), partySize,
      Number(body.eventDuration), body.eventName.trim(), body.eventDate, body.eventTime,
      body.description_info.trim(), catering, equipment, cooksNeeded, staffNeeded, rooms,
      equipment ? Number(body.chairsAmount || 0) : 0, equipment ? Number(body.tablesAmount || 0) : 0,
    ]);
    res.redirect(303, '/form.html?submitted=1');
  } catch (error) {
    if (error.code === '23505') return res.status(409).send('An event with that name already exists.');
    console.error('Error submitting form:', error.code || 'UNKNOWN');
    res.status(500).send('Internal Server Error');
  }
});

// Use a valid dummy hash for unknown accounts to reduce username timing differences.
let dummyPasswordHash;
app.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || username.length > 50 || !password || password.length > 256) {
      return res.status(401).send('Invalid username or password');
    }
    const result = await pool.query('SELECT id, password, is_admin FROM employees WHERE username = $1', [username.trim()]);
    const account = result.rows[0];
    const valid = await verifyPassword(password, account ? account.password : dummyPasswordHash);
    if (!account || !valid) return res.status(401).send('Invalid username or password');
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.employeeId = account.id;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(account.is_admin ? '/admin.html' : '/employee.html');
  } catch (error) { next(error); }
});
app.post('/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('bac.sid', { path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie });
    res.redirect('/login.html');
  });
});

app.post('/submit_availability', requireEmployee, async (req, res) => {
  const { selectedDate, shift1Dropdown, shift2Dropdown, shift3Dropdown } = req.body;
  if (!validDate(selectedDate) || ![shift1Dropdown, shift2Dropdown, shift3Dropdown]
      .every(value => ['Available', 'Not Available'].includes(value))) {
    return res.status(400).send('Select a valid date and availability for all three shifts.');
  }
  try {
    await pool.query(`INSERT INTO availability (user_id, username, date, shift_1, shift_2, shift_3, job)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (username, date) DO UPDATE SET user_id=EXCLUDED.user_id,
        shift_1=EXCLUDED.shift_1, shift_2=EXCLUDED.shift_2, shift_3=EXCLUDED.shift_3, job=EXCLUDED.job`,
      [req.employee.id, req.employee.username, selectedDate, shift1Dropdown, shift2Dropdown, shift3Dropdown, req.employee.job]);
    res.redirect('/employee.html?submitted=1');
  } catch (error) {
    console.error('Error submitting shift availability:', error.code || 'UNKNOWN');
    res.status(500).send('Internal Server Error');
  }
});

// Account creation is an administrator operation, including creation of another admin.
app.post('/create_employee', requireEmployee, requireAdmin, async (req, res, next) => {
  try {
    const { username, password, job, isAdmin = false } = req.body;
    if (typeof username !== 'string' || !username.trim() || username.trim().length > 50 ||
        typeof password !== 'string' || password.length < 12 || password.length > 256 || !password.trim() ||
        typeof job !== 'string' || !job.trim() || job.trim().length > 100 || typeof isAdmin !== 'boolean') {
      return res.status(400).json({ error: 'Username (1–50), password (12–256), job (1–100), and boolean isAdmin required' });
    }
    await pool.query('INSERT INTO employees (username, password, is_admin, job) VALUES ($1, $2, $3, $4)',
      [username.trim(), await hashPassword(password), isAdmin, job.trim()]);
    res.sendStatus(201);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(error);
  }
});

// Handle the /schedule endpoint to fetch events
app.get('/schedule', requireEmployee, async (req, res) => {
  try {
    // Fetch events from the database
    const query = `
      SELECT party_size, event_duration, event_name, to_char(event_date, 'YYYY-MM-DD') AS event_date, to_char(event_time, 'HH24:MI') AS event_time, description_info, cateringcheckbox, equipmentcheckbox, cooksneeded, staffneeded
      FROM eventinfo
    `;


    const resultEvents = await pool.query(query);
    const formattedEvents = await Promise.all(resultEvents.rows.map(async event => {
      const shifts = coveredShifts(event.event_time, event.event_duration);
      let candidates = [];
      if (shifts.length) {
        // Column names come exclusively from coveredShifts, never request input.
        const available = shifts.map(field => `a.${field} = 'Available'`).join(' AND ');
        candidates = (await pool.query(`SELECT e.username, e.job FROM availability a
          JOIN employees e ON e.id = a.user_id AND e.username = a.username
          WHERE a.date = $1 AND ${available} ORDER BY e.id`, [event.event_date])).rows;
      }
      const { cooksneeded, staffneeded, ...fields } = event;
      return {
        ...fields,
        availableCooks: event.cateringcheckbox ? candidates.filter(row => row.job.toLowerCase() === 'cook').slice(0, Math.max(0, cooksneeded)).map(row => row.username) : [],
        availableStaff: candidates.filter(row => row.job === 'Event Staff').slice(0, Math.max(0, staffneeded)).map(row => row.username),
      };
    }));

    res.json(formattedEvents); // Send events data as JSON response

  } catch (error) {
    console.error('Error fetching events:', error.code || 'UNKNOWN');
    res.status(500).send('Internal Server Error');
  }
});


// Do not let default Express error pages/logs echo submitted values or session details.
app.use((error, req, res, next) => {
  console.error('Request failed:', error.code || 'UNKNOWN');
  if (res.headersSent) return next(error);
  res.status(error.status === 400 || error.status === 413 ? error.status : 500).send('Request failed');
});

initializeDatabase().then(async () => {
  dummyPasswordHash = await hashPassword(require('node:crypto').randomBytes(32).toString('hex'));
  app.listen(port, host, () => console.log(`Server is running at http://${host}:${port}`));
}).catch(async error => {
  console.error('Database initialization failed:', error.code || 'UNKNOWN');
  await pool.end();
  process.exitCode = 1;
});
