const { sequelize } = require('../config/database');
const User = require('../models/User');
const APIKey = require('../models/APIKey');
const Permission = require('../models/Permission');
const { encode } = require('../services/jwtService');
const { verifyHMAC } = require('../services/apiKeyVerifier');
const { generateHash } = require('../utils/saltedCrc32');
const logger = require('../utils/logger');
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');
const ipaddr = require('ipaddr.js');

const STATE_CHANGING_VERBS = ['POST', 'PUT', 'PATCH', 'DELETE', 'TRACE'];

const loadAuthzRules = () => {
  const rulesPath = process.env.AUTHZ_RULES_FILE || path.join(__dirname, '../../config/authz_rules.yml');
  try {
    const fileContent = fs.readFileSync(rulesPath, 'utf8');
    const parsed = yaml.parse(fileContent);
    return parsed.rules || { pass: [], block: [] };
  } catch (error) {
    logger.warn('Authz rules file not found, using defaults');
    return { pass: [], block: [] };
  }
};

const underPathRules = (path, type, rules) => {
  if (!rules[type]) return false;
  return rules[type].some(rule => path.startsWith(rule));
};

const findIP = (ipString) => {
  try {
    const addr = ipaddr.process(ipString);
    if (addr.kind() === 'ipv4') {
      const parts = addr.octets;
      return `${parts[0]}.${parts[1]}.0.0/16`;
    } else {
      const parts = addr.parts;
      return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::/96`;
    }
  } catch (e) {
    return ipString;
  }
};

const getRemoteIP = (req) => {
  let ip = req.ip || req.connection.remoteAddress;

  if (process.env.GATEWAY === 'akamai') {
    const trueClientIP = req.headers['true-client-ip'];
    if (trueClientIP) {
      ip = trueClientIP;
    }
  }

  return ip;
};

const validateCSRF = (req, session) => {
  if (process.env.CSRF_PROTECTION !== 'true') return;

  if (!STATE_CHANGING_VERBS.includes(req.method)) return;

  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken) {
    logger.info(`CSRF attack warning! Missing token for uid: ${session.uid} in request to ${req.path} by ${req.method}`);
    throw new Error('authz.missing_csrf_token');
  }

  if (csrfToken !== session.csrfToken) {
    logger.info(`CSRF attack warning! Token is not valid for uid: ${session.uid} in request to ${req.path} by ${req.method}`);
    throw new Error('authz.csrf_token_mismatch');
  }
};

// A session ends when it times out or the browser changes. An IP change only
// gets logged (BF-048): behind Cloudflare the address we see can move between
// Cloudflare's own ranges, and mobile and office connections switch address
// too, so ending the session on it logged admins out every few minutes.
const validateSession = (req, session) => {
  const userAgent = req.headers['user-agent'];

  if (Date.now() / 1000 >= session.expireTime) {
    logger.info(`Session for uid ${session.uid} ended: timed out`);
    throw new Error('authz.client_session_mismatch');
  }
  if (userAgent !== session.userAgent) {
    logger.info(`Session for uid ${session.uid} ended: browser changed from "${session.userAgent}" to "${userAgent}"`);
    throw new Error('authz.client_session_mismatch');
  }

  const currentIP = getRemoteIP(req);
  if (findIP(currentIP) !== findIP(session.userIP)) {
    logger.info(`Session for uid ${session.uid} moved from IP ${session.userIP} to ${currentIP}, kept`);
    session.userIP = currentIP;
  }

  const sessionExpireTime = parseInt(process.env.SESSION_EXPIRE_TIME || '21600');
  session.expireTime = Math.floor(Date.now() / 1000) + sessionExpireTime;
};

const validatePermissions = async (user, req) => {
  const fullPath = req.originalUrl || (req.baseUrl + req.path);
  const pathWithoutQuery = fullPath.split('?')[0];
  
  logger.debug(`[AUTHZ] Validating permissions for user ${user.uid} (role: ${user.role})`);
  logger.debug(`[AUTHZ] Request path: ${req.path}, full path: ${pathWithoutQuery}, method: ${req.method}`);

  const permissions = await Permission.findAll({
    where: {
      role: user.role,
      verb: [req.method, 'ALL'],
    },
  });

  logger.debug(`[AUTHZ] Found ${permissions.length} permissions for role ${user.role} with verb ${req.method} or ALL`);
  logger.debug(`[AUTHZ] All permissions: ${JSON.stringify(permissions.map(p => ({ path: p.path, verb: p.verb, action: p.action })))}`);

  const matchingPermissions = permissions.filter(p => pathWithoutQuery.startsWith(p.path));
  logger.debug(`[AUTHZ] Matching permissions (path starts with): ${matchingPermissions.length}`);
  logger.debug(`[AUTHZ] Matching permissions details: ${JSON.stringify(matchingPermissions.map(p => ({ path: p.path, verb: p.verb, action: p.action })))}`);

  const actions = [...new Set(matchingPermissions.map(p => p.action))];
  logger.debug(`[AUTHZ] Actions found: ${JSON.stringify(actions)}`);

  if (matchingPermissions.length === 0) {
    logger.warn(`[AUTHZ] No matching permissions found for path ${pathWithoutQuery} with method ${req.method} for role ${user.role}`);
    throw new Error('authz.invalid_permission');
  }

  if (actions.includes('DROP')) {
    logger.warn(`[AUTHZ] DROP action found for path ${pathWithoutQuery}, blocking access`);
    throw new Error('authz.invalid_permission');
  }

  if (!actions.includes('ACCEPT')) {
    logger.warn(`[AUTHZ] No ACCEPT action found for path ${pathWithoutQuery}, available actions: ${JSON.stringify(actions)}`);
    throw new Error('authz.invalid_permission');
  }

  const auditPermission = matchingPermissions.find(p => p.action === 'AUDIT');
  if (auditPermission) {
    logger.debug(`[AUTHZ] AUDIT permission found, topic: ${auditPermission.topic}`);
    return auditPermission.topic;
  }

  logger.debug(`[AUTHZ] Permission validation successful`);
  return null;
};

const cookieOwner = async (req, session) => {
  validateCSRF(req, session);

  if (!session.uid) {
    throw new Error('authz.invalid_session');
  }

  const user = await User.findOne({ where: { uid: session.uid } });
  if (!user) {
    throw new Error('authz.invalid_session');
  }

  logger.debug(`User ${user.uid} authorization via cookies`);

  validateSession(req, session);

  if (!['active', 'pending'].includes(user.state)) {
    throw new Error('authz.user_not_active');
  }

  const topic = await validatePermissions(user, req);

  return { user, topic };
};

const apiKeyOwner = async (req) => {
  const kid = req.headers['x-auth-apikey'];
  const nonce = req.headers['x-auth-nonce'];
  const signature = req.headers['x-auth-signature'];

  if (!kid || !nonce || !signature) {
    throw new Error('authz.invalid_api_key_headers');
  }

  if (parseInt(nonce) <= 0) {
    throw new Error('authz.nonce_not_valid_timestamp');
  }

  const nonceTimestampWindow = Math.abs(Date.now() - parseInt(nonce));
  const nonceLifetime = parseInt(process.env.APIKEY_NONCE_LIFETIME || '5000');

  logger.debug(`Api key authorization via key: ${kid} to path ${req.path} with nonce: ${nonce} in a window of ${nonceTimestampWindow}`);

  if (nonceTimestampWindow >= nonceLifetime) {
    throw new Error('authz.nonce_expired');
  }

  const apiKey = await APIKey.findByKid(kid);
  if (!apiKey || !apiKey.active()) {
    throw new Error('authz.apikey_not_active');
  }

      const isValid = await verifyHMAC({
        kid,
        nonce,
        signature,
        secret: apiKey.secret,
        path: req.path,
        method: req.method,
      });

  if (!isValid) {
    throw new Error('authz.invalid_signature');
  }

  const user = await User.findByPk(apiKey.key_holder_account_id);
  if (!user) {
    throw new Error('authz.unexistent_apikey');
  }

  if (!['active', 'pending'].includes(user.state)) {
    throw new Error('authz.invalid_session');
  }

  if (user.otp === false) {
    throw new Error('authz.disabled_2fa');
  }

  const topic = await validatePermissions(user, req);

  return { user, topic };
};

const authorize = async (req, res, next) => {
  try {
    const rules = loadAuthzRules();
    const requestPath = req.path;

    if (underPathRules(requestPath, 'block', rules)) {
      return res.status(403).json({ errors: ['authz.path_blocked'] });
    }

    if (underPathRules(requestPath, 'pass', rules)) {
      return next();
    }

    let authOwner;
    const session = req.session;

    if (req.headers['x-auth-apikey'] && req.headers['x-auth-nonce'] && req.headers['x-auth-signature']) {
      authOwner = await apiKeyOwner(req);
    } else {
      authOwner = await cookieOwner(req, session);
    }

    const { user, topic } = authOwner;
    const token = 'Bearer ' + encode(user.asPayload());

    req.user = user;
    req.authToken = token;
    req.auditTopic = topic;

    next();
  } catch (error) {
    logger.debug(`Error raised with message: ${error.message}`);
    const errorCode = error.message.includes('authz.') ? 401 : 500;
    res.status(errorCode).json({ errors: [error.message] });
  }
};

module.exports = { authorize, getRemoteIP, validateCSRF, validateSession };

