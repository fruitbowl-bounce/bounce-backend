/**
 * @swagger
 * tags:
 *   - name: Identity
 *     description: Authentication and identity management endpoints
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { calculateEntropy } = require('../../../services/passwordStrengthChecker');

/**
 * @swagger
 * /api/v2/nebryx/identity/password/validate:
 *   post:
 *     summary: Validate password strength
 *     tags: [Identity]
 *     description: Check password entropy and strength
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *     responses:
 *       200:
 *         description: Password validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entropy:
 *                   type: number
 *                   description: Password entropy value
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/password/validate',
  [
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map(e => e.msg) });
      }

      const entropy = calculateEntropy(req.body.password);
      return res.json({ entropy });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/identity/ping:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Identity]
 *     description: Simple ping endpoint to check API availability
 *     responses:
 *       200:
 *         description: API is available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ping:
 *                   type: string
 *                   example: pong
 */
router.get('/ping', (req, res) => {
  res.json({ ping: 'pong' });
});

/**
 * @swagger
 * /api/v2/nebryx/identity/time:
 *   get:
 *     summary: Get server timestamp
 *     tags: [Identity]
 *     description: Returns current server timestamp in Unix format
 *     responses:
 *       200:
 *         description: Server timestamp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 time:
 *                   type: integer
 *                   description: Unix timestamp
 *                   example: 1699123456
 */
router.get('/time', (req, res) => {
  res.json({ time: Math.floor(Date.now() / 1000) });
});

router.get('/version', (req, res) => {
  res.json({
    git_tag: process.env.GIT_TAG || 'v1.0.0',
    git_sha: process.env.GIT_SHA || 'unknown',
    build_date: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
  });
});

/**
 * @swagger
 * /api/v2/nebryx/identity/configs:
 *   get:
 *     summary: Get API configurations
 *     tags: [Identity]
 *     description: Returns API configuration settings
 *     responses:
 *       200:
 *         description: API configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_expire_time:
 *                   type: integer
 *                 captcha_type:
 *                   type: string
 *                 captcha_id:
 *                   type: string
 *                   nullable: true
 *                 phone_verification_type:
 *                   type: string
 *                 password_min_entropy:
 *                   type: integer
 *                 password_regexp:
 *                   type: string
 */
router.get('/configs', (req, res) => {
  res.json({
    session_expire_time: parseInt(process.env.SESSION_EXPIRE_TIME || '3600'),
    captcha_type: process.env.CAPTCHA_TYPE || 'none',
    captcha_id: process.env.RECAPTCHA_SITE_KEY || null,
    phone_verification_type: process.env.PHONE_VERIFICATION || 'none',
    password_min_entropy: parseInt(process.env.PASSWORD_MIN_ENTROPY || '50'),
    password_regexp: process.env.PASSWORD_REGEXP || '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
  });
});

module.exports = router;

