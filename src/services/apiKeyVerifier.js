const crypto = require('crypto');

const verifyHMAC = async ({ kid, nonce, signature, secret, path, method }) => {
  const payload = `${method}${path}${nonce}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

module.exports = { verifyHMAC };

