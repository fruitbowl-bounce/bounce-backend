const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const getKey = () => {
  if (KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes hex)');
  }
  return Buffer.from(KEY, 'hex');
};

const encrypt = (text) => {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

module.exports = { encrypt, decrypt };

