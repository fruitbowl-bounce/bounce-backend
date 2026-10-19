const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/User');
const { sendEmail } = require('./email');
const logger = require('../utils/logger');

// Admin panel invites: a superadmin adds someone by email, they get a link
// and set their own password there. Until then the account is "invited" and
// can't log in (sessions only allow active/pending). The link works once and
// for INVITE_HOURS. Only a SHA-256 of its token is stored.
const INVITE_HOURS = 72;
const INVITE_ROLES = ['superadmin', 'admin', 'viewer'];

const digest = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const inviteUrl = (token) => {
  const protocol = process.env.APP_PROTOCOL || 'http';
  const domain = process.env.APP_DOMAIN || 'localhost:8443';
  return `${protocol}://${domain}/admin/invite/${token}`;
};

// New link (any earlier one stops working) and the invite email.
const sendInvite = async (user, invitedBy) => {
  const token = crypto.randomBytes(32).toString('hex');
  await user.update({
    invite_token_digest: digest(token),
    invite_expires_at: new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000),
  });
  await sendEmail({
    eventKey: 'admin.invite',
    to: user.email,
    language: 'en',
    data: {
      inviteUrl: inviteUrl(token),
      role: user.role === 'viewer' ? 'viewer (read only)' : user.role,
      invitedBy: invitedBy?.email || '',
      hours: INVITE_HOURS,
    },
  });
  logger.info(`Admin invite sent to ${user.email} (${user.role})`);
};

// The invited account for a link, or null if it's wrong, used or expired.
const findInvite = async (token) => {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  return User.findOne({
    where: {
      invite_token_digest: digest(token),
      invite_expires_at: { [Op.gt]: new Date() },
      state: 'invited',
    },
  });
};

module.exports = { INVITE_HOURS, INVITE_ROLES, sendInvite, findInvite };
