// No database needed. Parse application/check scripts and inline HTML JavaScript.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
let count = 0;
for (const directory of [root, __dirname]) {
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', path.join(directory, name)], { stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) process.exit(result.status || 1);
    count++;
  }
}
for (const name of fs.readdirSync(path.join(root, 'html')).filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, 'html', name), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) new vm.Script(match[1], { filename: name });
  }
}
console.log(`Syntax OK: ${count} JavaScript files and inline HTML scripts.`);
