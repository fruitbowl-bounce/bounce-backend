const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const redis = require('redis');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.connect().catch(console.error);

const ISSUER_NAME = process.env.APP_NAME || 'Nebryx';

const totpKey = (uid) => `totp:keys:${uid}`;
const totpCodeKey = (uid) => `totp:code:${uid}`;

const create = async (uid, email) => {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER_NAME} (${email})`,
    issuer: ISSUER_NAME,
  });

  await redisClient.setEx(totpKey(uid), 86400 * 365, secret.base32);

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCodeUrl,
    otpauth_url: secret.otpauth_url,
  };
};

const exist = async (uid) => {
  const secret = await redisClient.get(totpKey(uid));
  return !!secret;
};

const validate = async (uid, code) => {
  const secret = await redisClient.get(totpKey(uid));
  if (!secret) {
    return false;
  }

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 2,
  });

  if (verified) {
    const codeKey = totpCodeKey(uid);
    const usedCode = await redisClient.get(`${codeKey}:${code}`);
    if (usedCode) {
      return false;
    }
    await redisClient.setEx(`${codeKey}:${code}`, 60, '1');
  }

  return verified;
};

const deleteSecret = async (uid) => {
  await redisClient.del(totpKey(uid));
};

const getSecret = async (uid) => {
  return await redisClient.get(totpKey(uid));
};

module.exports = {
  create,
  exist,
  validate,
  delete: deleteSecret,
  getSecret,
};

