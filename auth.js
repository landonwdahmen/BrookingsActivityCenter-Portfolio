// Post-course portfolio authentication helpers. No third-party native build required.
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const deriveKey = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const format = /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{64}$/;

function isPasswordHash(value) {
  return typeof value === 'string' && format.test(value);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 32, options);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  if (!isPasswordHash(encoded)) return false;
  const parts = encoded.split('$');
  const key = await deriveKey(password, parts[4], 32, options);
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex'));
}

module.exports = { hashPassword, verifyPassword, isPasswordHash };
