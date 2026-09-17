/**
 * @swagger
 * tags:
 *   - name: Identity
 *     description: Authentication and identity management endpoints
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../../../models/User');
const totpService = require('../../../services/totpService');
const { createSession, destroySession } = require('../../../services/sessionService');
const { logActivity } = require('../../../services/activityLogger');
const { verifyCaptcha } = require('../../../services/captchaService');
const logger = require('../../../utils/logger');
const crypto = require('crypto');

/**
 * @swagger
 * /api/v2/nebryx/identity/sessions:
 *   post:
 *     summary: Create session (login)
 *     tags: [Identity]
 *     description: Authenticate user and create a session. Returns user data and CSRF token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *               otp_code:
 *                 type: string
 *                 description: OTP code if 2FA is enabled
 *                 example: "123456"
 *               captcha_response:
 *                 type: string
 *                 description: Captcha response if captcha is enabled
 *     responses:
 *       200:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Session'
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  [
    body('email').isEmail().withMessage('identity.session.missing_email'),
    body('password').notEmpty().withMessage('identity.session.missing_password'),
    body('otp_code').optional().isString(),
    body('captcha_response').optional(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(e => {
          if (e.param === 'email' && e.msg === 'Invalid value') {
            return 'identity.session.missing_email';
          }
          if (e.param === 'password' && e.msg === 'Invalid value') {
            return 'identity.session.missing_password';
          }
          return e.msg;
        });
        return res.status(422).json({ errors: errorMessages });
      }

      if (req.body.captcha_response) {
        const captchaValid = await verifyCaptcha(req.body.captcha_response, 'session_create');
        if (!captchaValid) {
          return res.status(422).json({ errors: ['identity.session.invalid_captcha'] });
        }
      }

      const { email, password, otp_code } = req.body;
      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      const trimmedPassword = password ? String(password).trim() : null;

      if (!normalizedEmail || !trimmedPassword) {
        return res.status(422).json({ 
          errors: [
            !normalizedEmail ? 'identity.session.missing_email' : null,
            !trimmedPassword ? 'identity.session.missing_password' : null
          ].filter(Boolean)
        });
      }

      const user = await User.findOne({ where: { email: normalizedEmail } });
      if (!user) {
        logger.warn(`Login attempt failed: User not found for email ${normalizedEmail}`);
        return res.status(401).json({ errors: ['identity.session.invalid_params'] });
      }

      if (user.state === 'banned') {
        await logActivity({
          user_id: user.id,
          action: 'login',
          result: 'failed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'banned' }),
        });
        return res.status(401).json({ errors: ['identity.session.banned'] });
      }

      if (user.state === 'deleted') {
        await logActivity({
          user_id: user.id,
          action: 'login',
          result: 'failed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'deleted' }),
        });
        return res.status(401).json({ errors: ['identity.session.deleted'] });
      }

      if (!['active', 'pending'].includes(user.state)) {
        await logActivity({
          user_id: user.id,
          action: 'login',
          result: 'failed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'not_active' }),
        });
        return res.status(401).json({ errors: ['identity.session.not_active'] });
      }

      if (!user.password_digest) {
        logger.error(`Login attempt failed: No password_digest for user ${user.email} (ID: ${user.id})`);
        await logActivity({
          user_id: user.id,
          action: 'login',
          result: 'failed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'no_password_digest' }),
        });
        return res.status(401).json({ errors: ['identity.session.invalid_params'] });
      }

      const isPasswordValid = await user.authenticate(trimmedPassword);
      if (!isPasswordValid) {
        logger.warn(`Login attempt failed: Invalid password for user ${user.email} (ID: ${user.id})`);
        await logActivity({
          user_id: user.id,
          action: 'login',
          result: 'failed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'invalid_params' }),
        });
        return res.status(401).json({ errors: ['identity.session.invalid_params'] });
      }

      if (!user.otp) {
        const csrfToken = crypto.randomBytes(32).toString('hex');
        await createSession(req, user, csrfToken);

        await logActivity({
          user_id: user.id,
          action: 'login',
          result: 'succeed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
        });

        return res.status(200).json({
          ...(await user.asJsonForEventApi()),
          csrf_token: csrfToken,
        });
      }

      if (!otp_code) {
        return res.status(401).json({ errors: ['identity.session.missing_otp'] });
      }

      const otpValid = await totpService.validate(user.uid, otp_code);
      if (!otpValid) {
        await logActivity({
          user_id: user.id,
          action: 'login::2fa',
          result: 'failed',
          topic: 'session',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'invalid_otp' }),
        });
        return res.status(403).json({ errors: ['identity.session.invalid_otp'] });
      }

      const csrfToken = crypto.randomBytes(32).toString('hex');
      await createSession(req, user, csrfToken);

      await logActivity({
        user_id: user.id,
        action: 'login::2fa',
        result: 'succeed',
        topic: 'session',
        user_ip: req.ip,
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(200).json({
        ...(await user.asJsonForEventApi()),
        csrf_token: csrfToken,
      });
    } catch (error) {
      logger.error('Session creation error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/identity/sessions:
 *   delete:
 *     summary: Destroy session (logout)
 *     tags: [Identity]
 *     description: Destroy the current user session
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: Session destroyed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Session destroyed
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/', async (req, res, next) => {
  try {
    if (!req.session.uid) {
      return res.status(404).json({ errors: ['identity.session.not_found'] });
    }

    const user = await User.findOne({ where: { uid: req.session.uid } });
    if (!user) {
      return res.status(404).json({ errors: ['identity.session.not_found'] });
    }

    await logActivity({
      user_id: user.id,
      action: 'logout',
      result: 'succeed',
      topic: 'session',
      user_ip: req.ip,
      user_agent: req.headers['user-agent'],
      path: req.path,
      verb: req.method,
    });

    await destroySession(req, user);

    return res.status(200).json({ message: 'Session destroyed' });
  } catch (error) {
    logger.error('Session destruction error:', error);
    next(error);
  }
});

module.exports = router;

