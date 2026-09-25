const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path'); // Import path module to work with file paths

// Initialize Express app
const app = express();
const port = 3000;

// Middleware to parse JSON data
app.use(bodyParser.json());

// Middleware to parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "html" directory
app.use(express.static(__dirname + '/html'));

// Serve the admin.html file
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'BAC',
  password: 'root',
  port: 5432,
});

// Handle the /schedule endpoint to fetch events
app.get('/Eventschedule', async (req, res) => {
  try {
    // Fetch events from the database
    const query = `
      SELECT *
      FROM eventinfo
      WHERE event_date >= CURRENT_DATE  -- Fetch events from today onwards
    `;
    const result = await pool.query(query);
    res.json(result.rows); // Send events data as JSON response
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Internal Server Error');
  }
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
    password VARCHAR(100) NOT NULL,
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

// Set initial value for sequence
const setInitialSequenceValue = `
  SELECT setval('employees_id_seq', COALESCE((SELECT MAX(id)+1 FROM employees), 1), false);
`;

// Insert initial data into employees table
const insertInitialEmployeesData = `
  INSERT INTO employees (username, password, is_admin, job)
  VALUES 
  ('Johnny', '123', TRUE, 'admin'), 
  ('Jacob', '456', TRUE, 'admin'), 
  ('Kyle', '789', TRUE, 'admin'), 
  ('Carter', '000', TRUE, 'admin'), 
  ('Carters', 'Mom', false, 'cook'),
  ('Tom', 'isCool', FALSE, 'cook'), 
  ('Jack', 'abc', FALSE, 'Event Staff'), 
  ('Henry', 'abc123', FALSE, 'cook'), 
  ('Jen', '123', FALSE, 'cook'),
  ('Ken', '567', FALSE, 'Event Staff')
  ON CONFLICT (username) DO NOTHING
`;

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

(async () => {
  try {
    const client = await pool.connect();
    await client.query(createEventInfoTable);
    await client.query(eventsTestData);
    await client.query(createEmployeesTable);
    await client.query(createSequence);
    //await client.query(setInitialSequenceValue);
    await client.query(insertInitialEmployeesData);
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
    client.release();
  } catch (err) {
    console.error('Error initializing database:', err);
  }
})();


app.post('/submit_form', async (req, res) => {
  try {
    const {
      contactName,
      contactEmail,
      contactPhone,
      partySize,
      eventDuration,
      eventName,
      eventDate,
      eventTime,
      description_info,
      cateringCheckbox,
      equipmentCheckbox,
      chairsAmount,
      tablesAmount,
    } = req.body;
    // Calculate cooksNeeded based on cateringCheckbox
    const cooksNeeded = cateringCheckbox ? Math.ceil(partySize / 50) : 0;
    const staffNeeded = 2 + Math.ceil(partySize / 50);

    const insertQuery = `
            INSERT INTO eventinfo
            (name, email, phone, party_size, event_duration, event_name, event_date, event_time, description_info, cateringCheckbox, equipmentCheckbox, cooksNeeded, staffNeeded)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `;

    const result = await pool.query(insertQuery, [
      contactName,
      contactEmail,
      contactPhone,
      partySize,
      eventDuration,
      eventName,
      eventDate,
      eventTime,
      description_info,
      cateringCheckbox,
      equipmentCheckbox,
      cooksNeeded,
      staffNeeded
    ]);

    const customerId = result.rows[0].id;


    res.redirect(`form.html`)
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Serve static files from the "html" directory
app.use(express.static(__dirname + '/html'));


// Handle login form submission
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const query = `
            SELECT * FROM employees
            WHERE username = $1 AND password = $2
        `;

    const result = await pool.query(query, [username, password]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      if (user.is_admin) {
        const userId = result.rows[0].id
        // res.json({ userId }); prints userID:3
        res.redirect(`/admin.html?userId=${userId}`);// Redirect to admin page if user is an admin
      } else {
        const userId = result.rows[0].id
        // res.json({ userId }); prints userID:3
        res.redirect(`/employee.html?userId=${userId}`);
        // Redirect to employee page if user is a regular employee
      }
    } else {
      // Invalid username or password
      res.send('Invalid Username or Password');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Serve the login page
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/html/login.html');
});

// Serve other static files
app.use(express.static(__dirname));




app.post('/submit_availability', async (req, res) => {
  try {
    const {
      selectedDate,
      shift1Dropdown,
      shift2Dropdown,
      shift3Dropdown,
      userId,
      job
    } = req.body;

    // Check if availability exists for the selected date
    const availabilityCheckQuery = `
      SELECT COUNT(*) AS count
      FROM availability
      WHERE user_id = $1
      AND date = $2
    `;
    const availabilityCheckResult = await pool.query(availabilityCheckQuery, [userId, selectedDate]);
    const availabilityCount = availabilityCheckResult.rows[0].count;

    if (availabilityCount > 0) {
      // Update existing availability
      const updateQuery = `
        UPDATE availability
        SET SHIFT_1 = $1, SHIFT_2 = $2, SHIFT_3 = $3
        WHERE user_id = $4 AND date = $5
      `;
      await pool.query(updateQuery, [shift1Dropdown, shift2Dropdown, shift3Dropdown, userId, selectedDate]);
    } else {
      // Insert new availability
      const employeeQuery = `
        SELECT username 
        FROM employees 
        WHERE id = $1
      `;
      const employeeResult = await pool.query(employeeQuery, [userId]);
      const employeeName = employeeResult.rows[0].username;

      const employeeJobQuery = `
        SELECT job 
        FROM employees 
        WHERE id = $1
      `;
      const employeeJobResult = await pool.query(employeeJobQuery, [userId]);
      const employeeJob = employeeJobResult.rows[0].job;

      const insertQuery = `
        INSERT INTO availability
        (user_id, username, date, SHIFT_1, SHIFT_2, SHIFT_3, job)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await pool.query(insertQuery, [
        userId,  // Using userId obtained from the form data
        employeeName,
        selectedDate,
        shift1Dropdown,
        shift2Dropdown,
        shift3Dropdown,
        employeeJob
      ]);
    }

    res.redirect(`/employee.html?userId=${userId}`);


  } catch (error) {
    console.error('Error submitting shift availability:', error);
    res.status(500).send('Internal Server Error');
  }
});






app.get('/employee.html', (req, res) => {
  const userId = req.query.userId; // Extract userId from the URL query parameters
  res.render(__dirname + '/path/to/employee.html', { userId }); // Pass userId to the template
});





// Parse JSON, this is necessary because the client sends JSON data
app.use(bodyParser.json());

// Parse URL-encoded bodies for form data
app.use(bodyParser.urlencoded({ extended: true }));


// Handle employee creation
app.post('/create_employee', async (req, res) => {
  try {
    const { username, password, isAdmin, job } = req.body;

    // If isAdmin is null or undefined, set it to false
    const isAdminValue = isAdmin || false;

    const insertQuery = `
          INSERT INTO employees (username, password, is_admin, job)
          VALUES ($1, $2, $3, $4)
      `;

    await pool.query(insertQuery, [username, password, isAdminValue, job]);

    res.sendStatus(201); // Send a 201 status code to indicate successful creation
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Handle the /schedule endpoint to fetch events
app.get('/schedule', async (req, res) => {
  try {
    // Fetch events from the database
    const query = `
      SELECT id, name, email, phone, party_size, event_duration, event_name, event_date, event_time, description_info, cateringcheckbox, equipmentcheckbox, cooksneeded, staffneeded
      FROM eventinfo
    `;


    const resultEvents = await pool.query(query);
    // Fetch available cooks from the availability table
    const queryAvailabilityCooks = `
      SELECT username
      FROM availability
      WHERE (job = 'cook' or job = 'Cook') AND date = $1
      LIMIT $2
    `;

    const queryAvailabilityEventStaff = `
      SELECT username
      FROM availability
      WHERE job = 'Event Staff' AND date = $1
      LIMIT $2
    `;


    const formattedEvents = await Promise.all(resultEvents.rows.map(async event => {
      // Format event_date and event_time before sending the response
      const formattedEvent = {
        ...event,
        event_date: event.event_date.toISOString().split('T')[0], // Format event_date as 'YYYY-MM-DD'
        event_time: event.event_time.slice(0, 5) // Extract time part of event_time (e.g., '10:00')
      };

      // Retrieve available cooks
      const resultAvailabilityCooks = await pool.query(queryAvailabilityCooks, [formattedEvent.event_date, formattedEvent.cooksneeded]);


      // Retrieve available event staff
      const resultAvailabilityEventStaff = await pool.query(queryAvailabilityEventStaff, [formattedEvent.event_date, formattedEvent.staffneeded]);

      // Add available cooks and event staff to the event data
      formattedEvent.availableCooks = resultAvailabilityCooks.rows.map(row => row.username);
      formattedEvent.availableStaff = resultAvailabilityEventStaff.rows.map(row => row.username);


      return formattedEvent;
    }));

    // console.log(formattedEvents.availableStaff);
    res.json(formattedEvents); // Send events data as JSON response

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Internal Server Error');
  }
});

