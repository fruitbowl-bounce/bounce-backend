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
const Label = require('../../../models/Label');
const Restriction = require('../../../models/Restriction');
const { validatePassword } = require('../../../services/passwordStrengthChecker');
const { logActivity } = require('../../../services/activityLogger');
const { getRemoteIP } = require('../../../middleware/authorize');
const { encode, decode } = require('../../../services/jwtService');
const { createSession } = require('../../../services/sessionService');
const logger = require('../../../utils/logger');
const redis = require('redis');
const crypto = require('crypto');
const emailService = require('../../../services/email');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.connect().catch(console.error);

/**
 * @swagger
 * /api/v2/nebryx/identity/users:
 *   post:
 *     summary: Create user (registration)
 *     tags: [Identity]
 *     description: Register a new user account
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
 *               username:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 12
 *                 pattern: '^[a-zA-Z0-9]+$'
 *                 example: "johndoe"
 *               refid:
 *                 type: string
 *                 description: Referral user ID
 *               captcha_response:
 *                 type: string
 *                 description: Captcha response if captcha is enabled
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       422:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('username').optional().isLength({ min: 4, max: 12 }).matches(/^[a-zA-Z0-9]+$/),
    body('refid').optional().isString(),
    body('captcha_response').optional(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { email, password, username, refid, captcha_response } = req.body;

      if (captcha_response) {
        const captchaValid = await require('../../../services/captchaService').verifyCaptcha(captcha_response, 'user_create');
        if (!captchaValid) {
          return res.status(422).json({ errors: ['identity.user.invalid_captcha'] });
        }
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(422).json({ errors: ['identity.user.password_weak'] });
      }

      let referralId = null;
      if (refid) {
        if (!refid.startsWith((process.env.UID_PREFIX || 'ID').toUpperCase())) {
          return res.status(422).json({ errors: ['identity.user.invalid_referral_format'] });
        }
        const referralUser = await User.findOne({ where: { uid: refid } });
        if (!referralUser) {
          return res.status(422).json({ errors: ['identity.user.referral_doesnt_exist'] });
        }
        referralId = referralUser.id;
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(422).json({ errors: ['identity.user.email_exists'] });
      }

      if (username) {
        const existingUsername = await User.findOne({ where: { username: username.toLowerCase() } });
        if (existingUsername) {
          return res.status(422).json({ errors: ['identity.user.username_exists'] });
        }
      }

      const user = await User.create({
        email,
        password,
        username,
        referral_id: referralId,
        state: 'pending',
      });

      await logActivity({
        user_id: user.id,
        action: 'create',
        result: 'succeed',
        topic: 'user',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      const jti = crypto.randomBytes(16).toString('hex');
      const confirmationToken = encode({
        sub: 'confirmation',
        email: user.email,
        uid: user.uid,
        jti,
      }, {
        expiresIn: parseInt(process.env.JWT_EXPIRE_TIME || '3600') + 's',
      });

      await redisClient.setEx(`confirmation:${jti}`, parseInt(process.env.JWT_EXPIRE_TIME || '3600'), 'pending');

      try {
        const appDomain = process.env.APP_DOMAIN || 'app.local.ai';
        const language = process.env.DEFAULT_LANGUAGE || 'en';
        const protocol = process.env.APP_PROTOCOL || 'https';
        const baseUrl = `${protocol}://${appDomain}`;

        await emailService.sendEmail({
          eventKey: 'user.email.confirmation.token',
          to: user.email,
          language: language,
          data: {
            user: {
              email: user.email,
              uid: user.uid,
              username: user.username,
            },
            record: {
              domain: baseUrl,
              token: confirmationToken,
            },
            year: new Date().getFullYear(),
          },
        });

        logger.info(`Registration confirmation email sent to ${user.email}`);
      } catch (emailError) {
        logger.error('Failed to send registration confirmation email:', emailError);
      }

      return res.status(201).json(await user.asJsonForEventApi());
    } catch (error) {
      logger.error('User creation error:', error);
      next(error);
    }
  }
);

router.post(
  '/access',
  [
    body('whitelink_token').notEmpty().withMessage('Whitelink token is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { whitelink_token } = req.body;
      const tokenStatus = await redisClient.get(`whitelink:${whitelink_token}`);

      if (tokenStatus === 'active') {
        const restriction = await Restriction.create({
          category: 'whitelist',
          scope: 'ip',
          value: getRemoteIP(req),
          state: 'enabled',
        });

        await redisClient.del(`whitelink:${whitelink_token}`);
        await redisClient.del('restrictions');

        return res.status(200).json({ message: 'Whitelist restriction created' });
      } else {
        return res.status(422).json({ errors: ['identity.user.access.invalid_token'] });
      }
    } catch (error) {
      logger.error('Access creation error:', error);
      next(error);
    }
  }
);

router.get('/register_geetest', async (req, res, next) => {
  try {
    return res.status(200).json({ message: 'Geetest registration endpoint' });
  } catch (error) {
    logger.error('Geetest registration error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/identity/users/email/generate_code:
 *   post:
 *     summary: Request email confirmation code
 *     tags: [Identity]
 *     description: Generate and send email confirmation code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               captcha_response:
 *                 type: string
 *                 description: Captcha response if captcha is enabled
 *     responses:
 *       201:
 *         description: Email confirmation code generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email confirmation code generated
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/email/generate_code',
  [
    body('email').isEmail().withMessage('identity.user.missing_email'),
    body('captcha_response').optional(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { email, captcha_response } = req.body;
      const normalizedEmail = email ? email.toLowerCase().trim() : null;

      if (captcha_response) {
        const captchaValid = await require('../../../services/captchaService').verifyCaptcha(captcha_response, 'email_confirmation');
        if (!captchaValid) {
          return res.status(422).json({ errors: ['identity.user.invalid_captcha'] });
        }
      }

      const user = await User.findOne({ where: { email: normalizedEmail } });

      if (!user || user.state === 'active') {
        return res.status(201).json({ message: 'Email confirmation code generated' });
      }

      const jti = crypto.randomBytes(16).toString('hex');
      const token = encode({
        sub: 'confirmation',
        email: normalizedEmail,
        uid: user.uid,
        jti,
      }, {
        expiresIn: parseInt(process.env.JWT_EXPIRE_TIME || '3600') + 's',
      });

      await redisClient.setEx(`confirmation:${jti}`, parseInt(process.env.JWT_EXPIRE_TIME || '3600'), 'pending');

      await logActivity({
        user_id: user.id,
        action: 'request email confirmation',
        result: 'succeed',
        topic: 'account',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(201).json({ message: 'Email confirmation code generated' });
    } catch (error) {
      logger.error('Email generate code error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/identity/users/email/confirm_code:
 *   post:
 *     summary: Confirm email address
 *     tags: [Identity]
 *     description: Confirm email address using confirmation token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Email confirmation token
 *                 example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Email confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Session'
 *       422:
 *         description: Invalid or utilized token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/email/confirm_code',
  [
    body('token').notEmpty().withMessage('Token is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { token } = req.body;

      let payload;
      try {
        payload = decode(token);
        if (payload.sub !== 'confirmation') {
          return res.status(422).json({ errors: ['identity.user.invalid_token'] });
        }
      } catch (error) {
        return res.status(422).json({ errors: ['identity.user.invalid_token'] });
      }

      const tokenUsed = await redisClient.get(`confirmation:${payload.jti}`);
      if (tokenUsed === 'utilized') {
        return res.status(422).json({ errors: ['identity.user.utilized_token'] });
      }

      const user = await User.findOne({ where: { email: payload.email } });
      if (!user || user.state === 'active') {
        return res.status(422).json({ errors: ['identity.user.active_or_doesnt_exist'] });
      }

      if (tokenUsed === 'pending') {
        const [label] = await Label.findOrCreate({
          where: {
            user_id: user.id,
            key: 'email',
            scope: 'private',
          },
          defaults: {
            value: 'verified',
          },
        });
        
        if (label.value !== 'verified') {
          label.value = 'verified';
          await label.save();
        }

        await redisClient.setEx(`confirmation:${payload.jti}`, parseInt(process.env.JWT_EXPIRE_TIME || '3600'), 'utilized');

        const csrfToken = crypto.randomBytes(32).toString('hex');
        await createSession(req, user, csrfToken);

        await logActivity({
          user_id: user.id,
          action: 'email confirmation',
          result: 'succeed',
          topic: 'account',
          user_ip: getRemoteIP(req),
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
        });

        return res.status(200).json({
          ...(await user.asJsonForEventApi()),
          csrf_token: csrfToken,
        });
      }

      return res.status(422).json({ errors: ['identity.user.invalid_token'] });
    } catch (error) {
      logger.error('Email confirm code error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/identity/users/password/generate_code:
 *   post:
 *     summary: Request password reset code
 *     tags: [Identity]
 *     description: Generate and send password reset code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               captcha_response:
 *                 type: string
 *                 description: Captcha response if captcha is enabled
 *     responses:
 *       201:
 *         description: Password reset code generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset code generated
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/password/generate_code',
  [
    body('email').isEmail().withMessage('identity.user.missing_email'),
    body('captcha_response').optional(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { email, captcha_response } = req.body;
      const normalizedEmail = email ? email.toLowerCase().trim() : null;

      if (captcha_response) {
        const captchaValid = await require('../../../services/captchaService').verifyCaptcha(captcha_response, 'password_reset');
        if (!captchaValid) {
          return res.status(422).json({ errors: ['identity.user.invalid_captcha'] });
        }
      }

      const user = await User.findOne({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(201).json({ message: 'Password reset code generated' });
      }

      const resetToken = crypto.randomBytes(10).toString('hex');
      const jti = crypto.randomBytes(16).toString('hex');
      const token = encode({
        sub: 'reset',
        email: normalizedEmail,
        uid: user.uid,
        reset_token: resetToken,
        jti,
      }, {
        expiresIn: parseInt(process.env.JWT_EXPIRE_TIME || '3600') + 's',
      });

      await redisClient.setEx(`reset_password_${normalizedEmail}`, parseInt(process.env.JWT_EXPIRE_TIME || '3600'), resetToken);
      await redisClient.setEx(`reset:${jti}`, parseInt(process.env.JWT_EXPIRE_TIME || '3600'), 'pending');

      await logActivity({
        user_id: user.id,
        action: 'request password reset',
        result: 'succeed',
        topic: 'password',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(201).json({ message: 'Password reset code generated' });
    } catch (error) {
      logger.error('Password generate code error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/identity/users/password/confirm_code:
 *   post:
 *     summary: Reset password
 *     tags: [Identity]
 *     description: Reset password using reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reset_password_token
 *               - password
 *               - confirm_password
 *             properties:
 *               reset_password_token:
 *                 type: string
 *                 description: Password reset token
 *                 example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePassword123!
 *               confirm_password:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePassword123!
 *     responses:
 *       201:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successful
 *       422:
 *         description: Validation error or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/password/confirm_code',
  [
    body('reset_password_token').notEmpty().withMessage('identity.user.missing_pass_token'),
    body('password').notEmpty().withMessage('identity.user.missing_password'),
    body('confirm_password').notEmpty().withMessage('identity.user.missing_confirm_password'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { reset_password_token, password, confirm_password } = req.body;

      if (password !== confirm_password) {
        return res.status(422).json({ errors: ['identity.user.passwords_doesnt_match'] });
      }

      let payload;
      try {
        payload = decode(reset_password_token);
        if (payload.sub !== 'reset') {
          return res.status(422).json({ errors: ['identity.user.invalid_token'] });
        }
      } catch (error) {
        return res.status(422).json({ errors: ['identity.user.invalid_token'] });
      }

      const storedResetToken = await redisClient.get(`reset_password_${payload.email}`);
      const tokenUsed = await redisClient.get(`reset:${payload.jti}`);

      if (storedResetToken !== payload.reset_token || tokenUsed === 'utilized') {
        return res.status(422).json({ errors: ['identity.user.utilized_token'] });
      }

      const user = await User.findOne({ where: { email: payload.email } });
      if (!user) {
        return res.status(422).json({ errors: ['identity.user.invalid_token'] });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        await logActivity({
          user_id: user.id,
          action: 'password reset',
          result: 'failed',
          topic: 'password',
          user_ip: getRemoteIP(req),
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'weak_password' }),
        });
        return res.status(422).json({ errors: ['identity.user.password_weak'] });
      }

      user.password = password;
      await user.save();

      await redisClient.del(`reset_password_${payload.email}`);
      await redisClient.setEx(`reset:${payload.jti}`, parseInt(process.env.JWT_EXPIRE_TIME || '3600'), 'utilized');

      await logActivity({
        user_id: user.id,
        action: 'password reset',
        result: 'succeed',
        topic: 'password',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      const sessionKeys = await redisClient.keys(`session:${user.uid}:*`);
      for (const key of sessionKeys) {
        await redisClient.del(key);
      }

      return res.status(201).json({ message: 'Password reset successful' });
    } catch (error) {
      logger.error('Password confirm code error:', error);
      next(error);
    }
  }
);

module.exports = router;

