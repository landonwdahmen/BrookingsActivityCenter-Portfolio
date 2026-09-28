// Focused checks; no test framework. Only run against this project's demo DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { coveredShifts } = require('../event-rules');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function checkFormHandlers() {
  // Run the actual browser scripts with small DOM doubles, including Confirm/Cancel.
  for (const [file, formId] of [['script.js', 'eventForm'], ['employeeScript.js', 'availabilityForm']]) {
    const nodes = {};
    const node = id => nodes[id] ||= { value: 'Available', style: {}, listeners: {}, options: [],
      addEventListener(type, callback) { this.listeners[type] = callback; },
      appendChild(option) { this.options.push(option); }, querySelector() { return {}; } };
    node('equipmentCheckbox').value = 'no';
    node('dateSelect').value = '2098-06-20';
    let confirmed = true;
    const data = { eventTime: '12:00', eventDate: '2098-06-20', eventName: 'Demo', eventDuration: '2',
      partySize: '101', description_info: 'Test', cateringCheckbox: 'no', equipmentCheckbox: 'no' };
    const sandbox = vm.createContext({ document: { getElementById: node, createElement: () => ({}) },
      FormData: function () { this.get = key => data[key]; }, window: { confirm: () => confirmed },
      alert() {}, URLSearchParams, location: { search: '' } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
    let prevented = 0;
    node(formId).listeners.submit({ preventDefault() { prevented++; } });
    assert.equal(prevented, 0, file + ': Confirm must allow one native submission');
    confirmed = false;
    node(formId).listeners.submit({ preventDefault() { prevented++; } });
    assert.equal(prevented, 1, file + ': Cancel must prevent submission');
    if (file === 'script.js') {
      assert.equal(node('chairsAmount').disabled, true);
      node('equipmentCheckbox').value = 'yes';
      node('equipmentCheckbox').listeners.change();
      assert.equal(node('chairsAmount').disabled, false);
    } else assert.equal(node('dateSelect').options.length, 7);
  }
}

async function main() {
  assert.equal(process.env.FUNCTIONALITY_SMOKE_TEST, 'bac-local-demo');
  const pool = new Pool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    database: process.env.POSTGRES_DB || 'bac_demo', user: process.env.POSTGRES_USER || 'bac_demo',
    password: process.env.POSTGRES_PASSWORD || 'local-demo-only' });
  const prefix = 'functioncheck_' + randomBytes(8).toString('hex');
  // Record intended unique names before requests: a write may succeed before a response fails.
  const names = [], accounts = [], usernames = [], sessionIds = new Set();
  const pass = label => console.log('PASS ' + label);
  let child, testError, childError;
  let base;
  const probe = net.createServer();

  const request = (route, cookie, data) => fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(10000),
    method: data === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}),
      ...(data === undefined ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }) },
    ...(data === undefined ? {} : { body: new URLSearchParams(data) }) });
  async function login(username, password) {
    const response = await request('/login', null, { username, password });
    const header = response.headers.get('set-cookie');
    // Track even the admin login's exact session; never delete other admin sessions.
    const cookie = header?.split(';')[0];
    if (cookie) {
      const signed = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
      if (signed.startsWith('s:')) sessionIds.add(signed.slice(2, signed.lastIndexOf('.')));
    }
    assert.equal(response.status, 302);
    assert(cookie, 'Login did not set a session cookie');
    return cookie;
  }
  try {
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
    const port = probe.address().port;
    await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    base = `http://127.0.0.1:${port}`;
    checkFormHandlers();
    pass('event/availability Confirm and Cancel handlers, equipment visibility, and date options');
    // Source boundaries, including exact end boundaries and conservative overnight handling.
    for (const [time, hours, expected] of [
      ['05:00', 8, ['shift_1']], ['12:00', 2, ['shift_1', 'shift_2']],
      ['13:00', 8, ['shift_2']], ['20:00', 2, ['shift_2', 'shift_3']],
      ['21:00', 3, ['shift_3']], ['23:00', 2, []], ['01:00', 1, []], ['04:00', 1, []],
    ]) assert.deepEqual(coveredShifts(time, hours), expected);
    const source = fs.readFileSync(path.join(__dirname, '../employeeScript.js'), 'utf8');
    const context = vm.createContext({});
    vm.runInContext(source.slice(0, source.indexOf('const dateSelect')), context);
    for (const [input, expected] of [['2026-09-27', '2026-09-28'], ['2026-09-28', '2026-10-05'], ['2026-12-31', '2027-01-04']]) {
      const dates = vm.runInContext(`getDatesForUpcomingWeek(new Date('${input}T12:00:00'))`, context);
      const first = dates[0];
      assert.equal([first.getFullYear(), String(first.getMonth() + 1).padStart(2, '0'), String(first.getDate()).padStart(2, '0')].join('-'), expected);
      assert.equal(dates.length, 7);
    }
    pass('shift boundaries, overnight conservatism, Sunday/Monday/year-rollover dates');
    child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), windowsHide: true,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'development', SESSION_COOKIE_SECURE: 'false', TRUST_PROXY: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', error => { childError = error; });
    let logs = '';
    child.stdout.on('data', data => { logs += data; });
    child.stderr.on('data', data => { logs += data; });
    let ready = false;
    for (let i = 0; i < 150; i++) {
      if (childError) throw childError;
      assert.equal(child.exitCode, null, 'Application exited before ready');
      assert.equal(child.signalCode, null, 'Application terminated before ready');
      try { if ((await request('/')).status === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, 'Application not ready');
    const admin = await login('Johnny', '123');
    const event = { contactName: 'Demo Person', contactEmail: 'demo@example.com', contactPhone: '111-222-3333',
      partySize: '101', eventDuration: '2', eventDate: '2098-06-20', eventTime: '12:00',
      description_info: 'Functionality test', cateringCheckbox: 'no', equipmentCheckbox: 'yes',
      chairsAmount: '12', tablesAmount: '3', roomTheater: 'on', roomBallroomA: 'on' };
    for (const [suffix, overrides] of [['no', {}], ['yes', { cateringCheckbox: 'yes' }],
      ['evening', { eventTime: '21:00' }], ['overnight', { eventTime: '23:00' }],
      ['noequipment', { equipmentCheckbox: 'no', chairsAmount: '99', tablesAmount: '99' }]]) {
      const name = prefix + '_' + suffix;
      names.push(name);
      const response = await request('/submit_form', null, { ...event, ...overrides, eventName: name });
      assert.equal(response.status, 303);
      assert.equal(response.headers.get('location'), '/form.html?submitted=1');
    }
    const rows = (await pool.query('SELECT *, event_date::text AS date_text, event_time::text AS time_text FROM eventinfo WHERE event_name=ANY($1)', [names])).rows;
    const no = rows.find(row => row.event_name.endsWith('_no'));
    assert.equal(no.cooksneeded, 0); assert.equal(no.cateringcheckbox, false);
    assert.equal(no.staffneeded, 5); assert.equal(no.party_size, 101); assert.equal(no.event_duration, 2);
    assert.equal(no.description_info, event.description_info); assert.equal(no.name, event.contactName);
    assert.equal(no.email, event.contactEmail); assert.equal(no.phone, event.contactPhone);
    assert.equal(no.date_text, event.eventDate); assert.equal(no.time_text, '12:00:00');
    assert.equal(no.equipmentcheckbox, true); assert.equal(no.chairs_amount, 12); assert.equal(no.tables_amount, 3);
    assert.deepEqual(no.rooms, ['roomBallroomA', 'roomTheater']);
    assert.equal(rows.find(row => row.event_name.endsWith('_yes')).cooksneeded, 3);
    assert.equal(rows.find(row => row.event_name.endsWith('_noequipment')).chairs_amount, 0);
    assert.equal(rows.find(row => row.event_name.endsWith('_noequipment')).tables_amount, 0);
    for (const invalid of [{ contactName: '' }, { contactEmail: 'bad' }, { partySize: '0' }, { eventDuration: '1.5' },
      { eventDate: '2098-02-30' }, { eventTime: '03:30' }, { cateringCheckbox: 'Blank' }, { chairsAmount: '-1' },
      { description_info: '' }, { eventDuration: '2147483647' }, { roomTheater: 'false', roomBallroomA: 'false' }]) {
      assert.equal((await request('/submit_form', null, { ...event, eventName: prefix + '_invalid', ...invalid })).status, 400);
    }
    assert.equal((await request('/submit_form', null, { ...event, eventName: names[0] })).status, 409);
    pass('valid/invalid forms, Yes/No formula, all persisted fields, and duplicate-name handling');

    // Create two isolated staff records through the authorized API.
    for (const [suffix, job] of [['cook', 'cook'], ['staff', 'Event Staff']]) {
      const username = prefix + '_' + suffix;
      usernames.push(username);
      const response = await fetch(base + '/create_employee', { method: 'POST', headers: { Cookie: admin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: prefix, job }) });
      assert.equal(response.status, 201);
      const id = (await pool.query('SELECT id FROM employees WHERE username=$1', [username])).rows[0].id;
      accounts.push(id);
      const cookie = await login(username, prefix);
      const availability = { selectedDate: event.eventDate, shift1Dropdown: 'Available', shift2Dropdown: 'Not Available', shift3Dropdown: 'Available' };
      assert.equal((await request('/submit_availability', cookie, availability)).status, 302);
      assert.equal((await request('/submit_availability', cookie, { ...availability, shift2Dropdown: 'Blank' })).status, 400);
      let schedule = await (await request('/schedule', cookie)).json();
      assert(!schedule.find(row => row.event_name === names[1]).availableCooks.includes(username));
      assert(!schedule.find(row => row.event_name === names[1]).availableStaff.includes(username));
      // Update the same date, then confirm that no duplicate was created.
      assert.equal((await request('/submit_availability', cookie, { ...availability, shift2Dropdown: 'Available' })).status, 302);
      const saved = (await pool.query('SELECT shift_1, shift_2, shift_3 FROM availability WHERE user_id=$1', [id])).rows;
      assert.deepEqual(saved, [{ shift_1: 'Available', shift_2: 'Available', shift_3: 'Available' }]);
      schedule = await (await request('/schedule', cookie)).json();
      const field = job === 'cook' ? 'availableCooks' : 'availableStaff';
      assert(schedule.find(row => row.event_name === names[1])[field].includes(username));
      assert.deepEqual(schedule.find(row => row.event_name === names[3])[field], []);
      if (job === 'cook') assert.deepEqual(schedule.find(row => row.event_name === names[0]).availableCooks, []);
      else assert(schedule.find(row => row.event_name === names[2]).availableStaff.includes(username));
    }
    pass('availability insert/update/status validation and timing-aware suggestions');

    const schedule = await (await request('/schedule', admin)).json();
    let initialized = 0, rendered = 0, options;
    const sandbox = vm.createContext({ document: { getElementById: () => ({}) }, alert() {}, FullCalendar: { Calendar: function (element, config) {
      initialized++; options = config; this.render = () => rendered++;
    } } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../calendar.js'), 'utf8'), sandbox);
    vm.runInContext('initializeCalendar()', sandbox);
    assert.equal(initialized, 1); assert.equal(rendered, 1); assert.equal(options.events, '/schedule');
    assert.equal(options.timeZone, 'local');
    for (const row of schedule) {
      const transformed = options.eventDataTransform(row);
      assert(transformed && Number.isFinite(new Date(transformed.start).getTime()));
      assert(Number.isFinite(new Date(transformed.end).getTime()));
      assert.equal(transformed.title, row.event_name);
    }
    const overnight = options.eventDataTransform(schedule.find(row => row.event_name === names[3]));
    assert.equal(overnight.start, '2098-06-20T23:00:00'); assert.equal(overnight.end, '2098-06-21T01:00:00');
    for (const file of ['admin', 'viewSchedule']) {
      const html = await (await request('/html/' + file + '.html', admin)).text();
      assert.equal((html.match(/src="\/calendar.js"/g) || []).length, 1);
      assert.equal((html.match(new RegExp('src="/' + file + '.js"', 'g')) || []).length, 1);
      assert(html.includes('fullcalendar@6.1.19/index.global.min.js'));
      assert(!fs.readFileSync(path.join(__dirname, '../' + file + '.js'), 'utf8').includes('fetch('));
    }
    pass('single calendar initialization/source and valid local date/time/duration mapping');
    for (const page of ['/', '/index.html', '/form.html', '/html/form.html', '/login.html', '/html/login.html',
      '/admin.html', '/html/admin.html', '/employee.html', '/html/employee.html', '/viewSchedule.html', '/html/viewSchedule.html']) {
      const response = await request(page, admin); assert.equal(response.status, 200);
      const html = await response.text();
      for (const [, url] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        if (url.startsWith('http') || url === '#') continue;
        assert(url.startsWith('/'), 'Relative asset/navigation path: ' + url);
        assert.equal((await request(url, admin)).status, 200, url);
      }
    }
    for (const route of ['/server.js', '/event-rules.js', '/auth.js', '/.env', '/package.json', '/docker-compose.yml']) {
      assert.equal((await request(route)).status, 404);
    }
    assert.equal((await request('/schedule')).status, 401);
    pass('page/navigation/assets, protected schedule, and blocked source/configuration paths');
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    const attempt = async (label, action) => {
      try { await action(); return true; }
      catch (error) { cleanupErrors.push({ label, error }); return false; }
    };
    // Stop writes before removing rows. Bound waits and escalate only this child.
    const stopped = await attempt('temporary server', () => stopChild(child));
    await attempt('port probe', async () => {
      if (probe.listening) await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    });
    const resolved = await attempt('resolve run employee IDs', async () => {
      const rows = await pool.query('SELECT id FROM employees WHERE username = ANY($1::text[])', [usernames]);
      for (const row of rows.rows) if (!accounts.includes(row.id)) accounts.push(row.id);
    });
    // Child/dependent rows first. Exact run names/IDs only; never a prefix DELETE.
    if (stopped && resolved) {
      const availabilityRemoved = await attempt('availability', () => pool.query(
        'DELETE FROM availability WHERE user_id = ANY($1::int[])', [accounts]));
      const sessionsRemoved = await attempt('sessions', () => pool.query(
        "DELETE FROM user_sessions WHERE sid = ANY($1::text[]) OR sess->>'employeeId' = ANY($2::text[])",
        [[...sessionIds], accounts.map(String)]));
      if (availabilityRemoved && sessionsRemoved) await attempt('employees', () => pool.query(
        'DELETE FROM employees WHERE id = ANY($1::int[]) AND username = ANY($2::text[])', [accounts, usernames]));
    }
    if (stopped) await attempt('events', () => pool.query(
      'DELETE FROM eventinfo WHERE event_name = ANY($1::text[])', [names.concat(prefix + '_invalid')]));
    await attempt('verify no run records remain', async () => {
      const result = await pool.query(`SELECT
        (SELECT count(*)::int FROM employees WHERE username = ANY($1::text[])) AS employees,
        (SELECT count(*)::int FROM availability WHERE user_id = ANY($2::int[]) OR username = ANY($1::text[])) AS availability,
        (SELECT count(*)::int FROM eventinfo WHERE event_name = ANY($3::text[])) AS events,
        (SELECT count(*)::int FROM user_sessions WHERE sid = ANY($4::text[]) OR sess->>'employeeId' = ANY($5::text[])) AS sessions`,
        [usernames, accounts, names.concat(prefix + '_invalid'), [...sessionIds], accounts.map(String)]);
      assert.deepEqual(result.rows[0], { employees: 0, availability: 0, events: 0, sessions: 0 });
      console.log('Cleanup verified: ' + JSON.stringify(result.rows[0]));
    });
    // Always close the pool, even if another cleanup action failed.
    await attempt('PostgreSQL pool', () => pool.end());
    if (cleanupErrors.length) {
      for (const { label, error } of cleanupErrors) console.error('Cleanup failed:', label, error.code || error.name);
      // Preserve the original assertion/operational failure; report cleanup failures separately.
      if (!testError) throw new AggregateError(cleanupErrors.map(item => item.error), 'Functionality cleanup failed');
    }
  }
}

async function stopChild(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const waitForExit = milliseconds => new Promise(resolve => {
    const done = () => { clearTimeout(timer); child.removeListener('exit', done); resolve(true); };
    const timer = setTimeout(() => { child.removeListener('exit', done); resolve(false); }, milliseconds);
    child.once('exit', done);
    if (child.exitCode !== null || child.signalCode !== null) done();
  });
  const exited = waitForExit(5000);
  child.kill('SIGTERM');
  if (await exited) return;
  const killed = waitForExit(5000);
  child.kill('SIGKILL');
  if (!await killed) throw new Error('Temporary server did not exit');
}
main().catch(error => { console.error('Functionality check failed:', error.message); process.exitCode = 1; });
