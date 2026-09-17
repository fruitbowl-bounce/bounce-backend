const crypto = require('crypto');

const SALT = process.env.CRC32_SALT || 'barong-salt-key';

const generateHash = (value) => {
  const hash = crypto.createHash('sha256').update(SALT + value).digest('hex');
  const crc32 = parseInt(hash.substring(0, 8), 16);
  return crc32;
};

module.exports = { generateHash };

