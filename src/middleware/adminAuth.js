const { validateCSRF, validateSession } = require('./authorize');
const User = require('../models/User');
const logger = require('../utils/logger');

// Mirrors authorize.js's cookieOwner flow (session lookup, CSRF, sliding
// expiry/IP/UA check) but swaps the generic Permission-table lookup for a
// hardcoded admin/superadmin role check.
const adminAuth = async (req, res, next) => {
  try {
    const session = req.session;
    if (!session?.uid) {
      return res.status(401).json({ errors: ['authz.invalid_session'] });
    }

    validateCSRF(req, session);

    const user = await User.findOne({ where: { uid: session.uid } });
    if (!user) {
      return res.status(401).json({ errors: ['authz.invalid_session'] });
    }

    if (!['active', 'pending'].includes(user.state)) {
      return res.status(401).json({ errors: ['authz.user_not_active'] });
    }

    validateSession(req, session);

    if (!['admin', 'superadmin', 'viewer'].includes(user.role)) {
      return res.status(403).json({ errors: ['authz.invalid_permission'] });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.message && error.message.startsWith('authz.')) {
      return res.status(401).json({ errors: [error.message] });
    }
    logger.error('Admin auth error:', error);
    res.status(401).json({ errors: ['authz.invalid_session'] });
  }
};

// A viewer (e.g. Matt's accountant, 13/10) can only read the applications
// list, each application's details and its documents: no Retry sync, no
// offer templates or admin accounts. Anything not listed here is refused.
const VIEWER_ALLOWED = [
  /^\/me$/,
  /^\/applications$/,
  /^\/applications\/\d+$/,
  /^\/applications\/\d+\/documents\/\d+\/url$/,
];

const viewerReadOnly = (req, res, next) => {
  if (req.user.role !== 'viewer') return next();
  if (req.method === 'GET' && VIEWER_ALLOWED.some((path) => path.test(req.path))) return next();
  return res.status(403).json({ errors: ['authz.invalid_permission'] });
};

const requireSuperadmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ errors: ['authz.invalid_permission'] });
  }
  next();
};

module.exports = { adminAuth, viewerReadOnly, requireSuperadmin };



