const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Bot protection for the public application form (BF-004/005/006). The page
// passes a Cloudflare Turnstile check once, swaps the Turnstile token for a
// signed form token, and sends that token on every lookup and save. A header
// rather than the session cookie, so it doesn't depend on how the proxy in
// front of us handles cookies.
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ACTION = 'application';
const TOKEN_TYPE = 'application_form';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const HEADER = 'x-form-token';

const isConfigured = () => !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

const verifyTurnstile = async (token, remoteIp) => {
  const params = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (remoteIp) params.set('remoteip', remoteIp);

  const response = await fetch(SITEVERIFY_URL, { method: 'POST', body: params });
  const result = await response.json();
  if (!result.success) {
    logger.warn(`Turnstile check failed from ${remoteIp}: ${(result['error-codes'] || []).join(', ')}`);
    return false;
  }
  // Cloudflare's test keys answer without an action.
  if (result.action && result.action !== TURNSTILE_ACTION) {
    logger.warn(`Turnstile token for action "${result.action}" used on the application form`);
    return false;
  }
  return true;
};

const issueFormToken = () => jwt.sign({ typ: TOKEN_TYPE }, process.env.SESSION_SECRET, {
  algorithm: 'HS256',
  expiresIn: TOKEN_TTL_SECONDS,
});

const isValidFormToken = (token) => {
  try {
    return jwt.verify(token, process.env.SESSION_SECRET, { algorithms: ['HS256'] }).typ === TOKEN_TYPE;
  } catch {
    return false;
  }
};

// Middleware for the endpoints only the application form should call.
const requireFormToken = (req, res, next) => {
  if (!isConfigured()) {
    return res.status(500).json({ errors: ['public.form_token.not_configured'] });
  }
  if (!isValidFormToken(req.get(HEADER))) {
    return res.status(403).json({ errors: ['public.form_token.invalid'] });
  }
  next();
};

module.exports = {
  TOKEN_TTL_SECONDS,
  isConfigured,
  verifyTurnstile,
  issueFormToken,
  requireFormToken,
};
