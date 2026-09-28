// Shared resource cleanup for the two focused integration scripts.
const assert = require('node:assert/strict');
function trackSession(header, sessionIds) {
  const cookie = header?.split(';')[0];
  if (cookie) {
    const signed = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
    if (signed.startsWith('s:')) sessionIds.add(signed.slice(2, signed.lastIndexOf('.')));
  }
  return cookie;
}
async function cleanupSmoke({ pool, child, probe, accounts, usernames, names = [], sessionIds, testError }) {
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
      'DELETE FROM eventinfo WHERE event_name = ANY($1::text[])', [names]));
    await attempt('verify no run records remain', async () => {
      const result = await pool.query(`SELECT
        (SELECT count(*)::int FROM employees WHERE username = ANY($1::text[])) AS employees,
        (SELECT count(*)::int FROM availability WHERE user_id = ANY($2::int[]) OR username = ANY($1::text[])) AS availability,
        (SELECT count(*)::int FROM eventinfo WHERE event_name = ANY($3::text[])) AS events,
        (SELECT count(*)::int FROM user_sessions WHERE sid = ANY($4::text[]) OR sess->>'employeeId' = ANY($5::text[])) AS sessions`,
        [usernames, accounts, names, [...sessionIds], accounts.map(String)]);
      assert.deepEqual(result.rows[0], { employees: 0, availability: 0, events: 0, sessions: 0 });
      console.log('Cleanup verified: ' + JSON.stringify(result.rows[0]));
    });
    // Always close the pool, even if another cleanup action failed.
    await attempt('PostgreSQL pool', () => pool.end());
    if (cleanupErrors.length) {
      for (const { label, error } of cleanupErrors) console.error('Cleanup failed:', label, error.code || error.name);
      // Preserve the original assertion/operational failure; report cleanup failures separately.
      if (!testError) throw new AggregateError(cleanupErrors.map(item => item.error), 'Smoke cleanup failed');
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
module.exports = { cleanupSmoke, trackSession };
