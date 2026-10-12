const redis = require('redis');
const logger = require('../utils/logger');
const { sendEmail } = require('./email');

// Counters kept in Redis so they survive restarts and deploys, for the
// limits express-rate-limit can't express: a daily cap on the paid lookups
// (BF-005/006) and new applications per IP (BF-004). If Redis is down the
// request goes through. These are a backstop, not the only protection.
let client = null;

const getClient = async () => {
  if (!client) {
    client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });
    client.on('error', (err) => logger.error('Usage limits Redis error:', err));
    await client.connect();
  }
  return client;
};

// Count for this key in the current window, or null if Redis is unavailable.
const increment = async (key, windowSeconds) => {
  try {
    const redisClient = await getClient();
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, windowSeconds);
    return count;
  } catch (error) {
    logger.error(`Usage counter ${key} unavailable:`, error);
    return null;
  }
};

// Goes to OPS_ALERT_EMAIL, or the team inbox when that isn't set.
const sendAlert = async (eventKey, data) => {
  const to = process.env.OPS_ALERT_EMAIL || process.env.TEAM_NOTIFICATION_EMAIL;
  if (!to) {
    logger.warn(`No OPS_ALERT_EMAIL or TEAM_NOTIFICATION_EMAIL, alert ${eventKey} not sent`, data);
    return;
  }
  try {
    await sendEmail({ eventKey, to, language: 'en', data });
  } catch (error) {
    logger.error(`Failed to queue alert ${eventKey}:`, error);
  }
};

const WARN_AT = 0.7;
const today = () => new Date().toISOString().slice(0, 10);

// Caps one upstream API (all endpoints together) at `envVar` calls a day.
// Emails an alert when 70% of the cap is used, and again when it's reached.
// Each fires once a day, because a counter only passes each number once.
const dailyCap = (name, label, envVar, defaultCap) => async (req, res, next) => {
  const cap = parseInt(process.env[envVar] || String(defaultCap));
  const count = await increment(`usage:${name}:${today()}`, 2 * 24 * 60 * 60);
  if (count === null) return next();

  const warnAt = Math.floor(cap * WARN_AT);
  if (count === warnAt || count === cap + 1) {
    const reached = count > cap;
    logger.warn(`${label} daily usage ${reached ? 'cap reached' : 'at 70%'}: ${count - (reached ? 1 : 0)} of ${cap}`);
    sendAlert('ops.usage_alert', {
      label,
      used: reached ? cap : count,
      cap,
      reached,
      envVar,
      date: today(),
    });
  }

  if (count > cap) {
    return res.status(429).json({ errors: [`public.${name}.daily_cap_reached`] });
  }
  next();
};

// True when this IP has started more than `perHour` new applications in
// the last hour. Fixed one-hour windows, which is close enough here.
const tooManyNewApplications = async (ip) => {
  const perHour = parseInt(process.env.NEW_APPLICATIONS_PER_IP_PER_HOUR || '10');
  const count = await increment(`usage:new_applications:${ip}`, 60 * 60);
  return count !== null && count > perHour;
};

module.exports = { dailyCap, tooManyNewApplications, sendAlert };
