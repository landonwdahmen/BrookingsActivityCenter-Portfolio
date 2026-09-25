// Focused HTTP/PostgreSQL checks for the post-course authentication pass.
// Run only against this project's disposable demo DB. No external test framework.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const net = require('node:net');
const { Pool } = require('pg');
const { hashPassword, verifyPassword, isPasswordHash } = require('../auth');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  assert.equal(process.env.AUTH_SMOKE_TEST, 'bac-local-demo',
    'Set AUTH_SMOKE_TEST=bac-local-demo only for a disposable BAC demo database.');
  const pool = new Pool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    database: process.env.POSTGRES_DB || 'bac_demo', user: process.env.POSTGRES_USER || 'bac_demo',
    password: process.env.POSTGRES_PASSWORD || 'local-demo-only' });
  const suffix = randomBytes(8).toString('hex');
  const username = `authcheck_${suffix}`;
  const password = `Demo-check-${suffix}`;
  let child, createdId, output = '', checks = 0;
  const pass = label => { checks++; console.log(`PASS ${label}`); };
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  async function request(route, cookie, body, extraHeaders = {}) {
    return fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: { ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function login(name, value, cookie) {
    const response = await request('/login', cookie, { username: name, password: value });
    assert.equal(response.status, 302);
    const header = response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
    assert.doesNotMatch(header, /; Secure/i); // This harness explicitly tests local HTTP.
    assert(!response.headers.get('location').includes('userId'));
    return header.split(';')[0];
  }
  try {
    const hash = await hashPassword(password);
    assert(isPasswordHash(hash));
    assert(await verifyPassword(password, hash));
    assert.equal(await verifyPassword('wrong', hash), false);
    assert.equal(await verifyPassword(password, password), false);
    assert.notEqual(hash, await hashPassword(password));
    pass('scrypt verification, malformed/plaintext rejection, and random salts');

    child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), windowsHide: true,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'development',
        SESSION_COOKIE_SECURE: 'false', TRUST_PROXY: 'false', MIGRATE_LEGACY_PASSWORDS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', value => { output += value; });
    child.stderr.on('data', value => { output += value; });
    let ready = false;
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null) throw Error('Server exited before readiness; check local database configuration.');
      try { if ((await request('/')).status === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, 'Server did not become ready');
    pass('server initialized real PostgreSQL and began listening');

    for (const page of ['admin', 'employee', 'viewSchedule']) {
      for (const prefix of ['/', '/html/']) {
        const response = await request(`${prefix}${page}.html?userId=1`);
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/login.html');
      }
    }
    for (const route of ['/schedule', '/Eventschedule']) assert.equal((await request(route)).status, 401);
    assert.equal((await request('/create_employee', null, { isAdmin: true })).status, 401);
    assert.equal((await request('/submit_availability', null, { userId: 1 })).status, 401);
    pass('six protected HTML URLs and all protected APIs reject unauthenticated requests');

    for (const route of ['/server.js', '/auth.js', '/package.json', '/.env', '/docker-compose.yml', '/html/../server.js']) {
      assert.equal((await request(route)).status, 404);
    }
    pass('server/configuration files remain inaccessible');
    assert.equal((await request('/login', null, { username: 'Tom', password: 'wrong' })).status, 401);
    assert.equal((await request('/login', null, { username: 'missing_account', password })).status, 401);
    const employee = await login('Tom', 'isCool');
    const admin = await login('Johnny', '123');
    pass('invalid login fails; employee/admin login succeeds with protected session cookies');
    for (const route of ['/admin.html', '/html/admin.html']) {
      assert.equal((await request(route, employee)).status, 403);
      assert.equal((await request(route, admin)).status, 200);
    }
    for (const route of ['/employee.html', '/html/employee.html', '/viewSchedule.html', '/html/viewSchedule.html']) {
      assert.equal((await request(route, employee)).status, 200);
    }
    assert.equal((await request('/create_employee', employee, { username, password, job: 'cook', isAdmin: true })).status, 403);
    pass('employee/admin page and account-creation authorization');
    assert.equal((await request('/create_employee', admin, { username, password, job: 'cook', isAdmin: 'true' })).status, 400);
    assert.equal((await request('/create_employee', admin, { username, password: 'short', job: 'cook' })).status, 400);
    assert.equal((await request('/create_employee', admin, { username: '', password, job: '' })).status, 400);
    assert.equal((await request('/create_employee', admin, { username, password, job: 'cook', isAdmin: false })).status, 201);
    const created = (await pool.query('SELECT id, password, is_admin FROM employees WHERE username=$1', [username])).rows[0];
    createdId = created.id;
    assert(isPasswordHash(created.password));
    assert.notEqual(created.password, password);
    assert(await verifyPassword(password, created.password));
    assert.equal(created.is_admin, false);
    assert.equal((await request('/create_employee', admin, { username, password, job: 'cook' })).status, 409);
    const newEmployee = await login(username, password);
    const demoAccounts = (await pool.query('SELECT password FROM employees')).rows;
    assert(demoAccounts.length >= 11 && demoAccounts.every(row => isPasswordHash(row.password)));
    pass('account validation, duplicate 409, seed/new hashes, and new-account login');

    const targetId = (await pool.query("SELECT id FROM employees WHERE username='Tom'")).rows[0].id;
    const availability = { selectedDate: '2099-01-01', shift1Dropdown: 'Available',
      shift2Dropdown: 'Not Available', shift3Dropdown: 'Available', userId: targetId, job: 'admin' };
    const before = (await pool.query('SELECT * FROM availability WHERE user_id=$1', [targetId])).rows;
    assert.equal((await request(`/submit_availability?userId=${targetId}`, newEmployee, availability)).status, 302);
    const own = (await pool.query('SELECT user_id, username, job FROM availability WHERE user_id=$1', [createdId])).rows;
    assert.deepEqual(own, [{ user_id: createdId, username, job: 'cook' }]);
    assert.deepEqual((await pool.query('SELECT * FROM availability WHERE user_id=$1', [targetId])).rows, before);
    pass('forged URL/body identity and job ignored; availability belongs to session employee');

    const schedule = await request('/schedule', employee);
    assert.equal(schedule.status, 200);
    assert.equal(schedule.headers.get('cache-control'), 'no-store');
    const events = await schedule.json();
    assert(events.length > 0);
    const allowed = ['party_size', 'event_duration', 'event_name', 'event_date', 'event_time', 'description_info',
      'cateringcheckbox', 'equipmentcheckbox', 'availableCooks', 'availableStaff'].sort();
    for (const event of events) assert.deepEqual(Object.keys(event).sort(), allowed);
    assert.equal((await request('/Eventschedule', employee)).status, 403);
    const upcoming = await request('/Eventschedule', admin);
    assert.equal(upcoming.status, 200);
    for (const event of await upcoming.json()) {
      assert.deepEqual(Object.keys(event).sort(), ['event_name', 'event_date', 'event_time', 'event_duration'].sort());
    }
    pass('schedule field allowlist excludes contact/account data; Eventschedule is admin-only');
    assert.equal((await request('/logout', employee, {}, { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await request('/schedule', employee)).status, 200);
    pass('cross-origin state change rejected');

    const rotated = await login(username, password, newEmployee);
    assert.notEqual(rotated, newEmployee);
    assert.equal((await request('/schedule', newEmployee)).status, 401);
    const sessionRows = (await pool.query('SELECT sess FROM user_sessions')).rows;
    assert(sessionRows.some(row => row.sess.employeeId === createdId));
    assert(sessionRows.every(row => Object.keys(row.sess).every(key => ['cookie', 'employeeId'].includes(key))));
    pass('login rotates/invalidate old session; PostgreSQL stores identity without credentials');
    for (const cookie of [employee, admin, rotated]) {
      assert.equal((await request('/logout', cookie, {})).status, 302);
      assert.equal((await request('/schedule', cookie)).status, 401);
    }
    assert(!output.includes(password));
    pass('logout invalidates old cookies; no test password in server output');
    console.log(`Completed ${checks} check groups.`);
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    // Remove only data created by this run; preserve academic seeds and other data.
    if (createdId) {
      await pool.query('DELETE FROM availability WHERE user_id=$1', [createdId]);
      await pool.query("DELETE FROM user_sessions WHERE sess->>'employeeId'=$1", [String(createdId)]);
      await pool.query('DELETE FROM employees WHERE id=$1 AND username=$2', [createdId, username]);
    }
    await pool.end();
  }
}
main().catch(error => { console.error('Authentication smoke check failed:', error.message); process.exitCode = 1; });
