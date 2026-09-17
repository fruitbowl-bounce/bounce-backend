const redis = require('redis');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.connect().catch(console.error);

const createSession = async (req, user, csrfToken) => {
  const sessionExpireTime = parseInt(process.env.SESSION_EXPIRE_TIME || '3600');
  const expireTime = Math.floor(Date.now() / 1000) + sessionExpireTime;

  req.session.uid = user.uid;
  req.session.userAgent = req.headers['user-agent'];
  req.session.userIP = req.ip || req.connection.remoteAddress;
  req.session.csrfToken = csrfToken;
  req.session.expireTime = expireTime;

  await redisClient.setEx(
    `session:${user.uid}:${req.sessionID}`,
    sessionExpireTime,
    JSON.stringify({
      uid: user.uid,
      userAgent: req.headers['user-agent'],
      userIP: req.ip || req.connection.remoteAddress,
      expireTime,
    })
  );

  return csrfToken;
};

const destroySession = async (req, user) => {
  if (user && user.uid) {
    await redisClient.del(`session:${user.uid}:${req.sessionID}`);
  }
  req.session.destroy();
};

module.exports = { createSession, destroySession };

