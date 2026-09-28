// Sequential suites share one disposable demo database. Never auto-enable guards.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
for (const flag of ['AUTH_SMOKE_TEST', 'FUNCTIONALITY_SMOKE_TEST']) {
  if (process.env[flag] !== 'bac-local-demo') {
    console.error(`Set ${flag}=bac-local-demo only for a disposable BAC database.`);
    process.exit(1);
  }
}
for (const file of ['auth-smoke.js', 'functionality-smoke.js']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) {
    console.error(`${file} failed`);
    process.exit(result.status || 1);
  }
}
