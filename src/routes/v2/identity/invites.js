const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { findInvite } = require('../../../services/adminInvites');
const { validatePassword } = require('../../../services/passwordStrengthChecker');
const { logActivity } = require('../../../services/activityLogger');
const { getRemoteIP } = require('../../../middleware/authorize');
const logger = require('../../../utils/logger');

// The page an invite email links to (/admin/invite/<token>): who the invite
// is for, then setting a password activates the account.
// See src/services/adminInvites.js.
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { errors: ['identity.invite.rate_limited'] },
});

const tokenParam = param('token').isString().notEmpty();

/**
 * @swagger
 * /api/v2/nebryx/identity/invites/{token}:
 *   get:
 *     summary: The admin panel invite behind an email link
 *     tags: [Identity]
 *     responses:
 *       200: { description: "{ email, role }" }
 *       404: { description: identity.invite.invalid (wrong, used or expired link) }
 */
router.get('/:token', inviteLimiter, [tokenParam], async (req, res, next) => {
  try {
    const user = validationResult(req).isEmpty() ? await findInvite(req.params.token) : null;
    if (!user) return res.status(404).json({ errors: ['identity.invite.invalid'] });
    return res.json({ email: user.email, role: user.role });
  } catch (error) {
    logger.error('Get invite error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/identity/invites/{token}/accept:
 *   post:
 *     summary: Accept an admin panel invite by setting a password
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, confirm_password]
 *             properties:
 *               password: { type: string }
 *               confirm_password: { type: string }
 *     responses:
 *       200: { description: Account active, they can log in }
 *       404: { description: identity.invite.invalid }
 *       422: { description: identity.user.passwords_doesnt_match or identity.user.password_weak }
 */
router.post(
  '/:token/accept',
  inviteLimiter,
  [
    tokenParam,
    body('password').isString().notEmpty().withMessage('identity.user.missing_password'),
    body('confirm_password').isString().notEmpty().withMessage('identity.user.missing_confirm_password'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const user = await findInvite(req.params.token);
      if (!user) return res.status(404).json({ errors: ['identity.invite.invalid'] });

      const { password, confirm_password } = req.body;
      if (password !== confirm_password) {
        return res.status(422).json({ errors: ['identity.user.passwords_doesnt_match'] });
      }
      if (!validatePassword(password).valid) {
        return res.status(422).json({ errors: ['identity.user.password_weak'] });
      }

      user.password = password;
      user.state = 'active';
      user.invite_token_digest = null;
      user.invite_expires_at = null;
      await user.save();

      await logActivity({
        user_id: user.id,
        action: 'accept invite',
        result: 'succeed',
        topic: 'password',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });
      logger.info(`Admin invite accepted by ${user.email}`);
      return res.json({ email: user.email });
    } catch (error) {
      logger.error('Accept invite error:', error);
      next(error);
    }
  }
);

module.exports = router;
