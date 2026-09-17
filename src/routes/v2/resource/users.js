/**
 * @swagger
 * tags:
 *   - name: Resource
 *     description: User resource management endpoints (requires authentication)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../../../models/User');
const Activity = require('../../../models/Activity');
const totpService = require('../../../services/totpService');
const { logActivity } = require('../../../services/activityLogger');
const { validatePassword } = require('../../../services/passwordStrengthChecker');
const logger = require('../../../utils/logger');

/**
 * @swagger
 * /api/v2/nebryx/resource/users/me:
 *   get:
 *     summary: Get current user
 *     tags: [Resource]
 *     description: Get current authenticated user information
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['profiles', 'phones', 'labels'],
    });
    return res.json(await user.asJsonForEventApi());
  } catch (error) {
    logger.error('Get user error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/resource/users/me:
 *   put:
 *     summary: Update current user
 *     tags: [Resource]
 *     description: Update current user data
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON string containing user data
 *                 example: '{"preferences": {"theme": "dark"}}'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/me',
  [
    body('data').notEmpty().withMessage('Data is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      try {
        JSON.parse(req.body.data);
      } catch (e) {
        return res.status(422).json({ errors: ['Invalid JSON format'] });
      }

      await req.user.update({ data: req.body.data });
      const updatedUser = await User.findByPk(req.user.id);

      return res.json(await updatedUser.asJsonForEventApi());
    } catch (error) {
      logger.error('Update user error:', error);
      next(error);
    }
  }
);

router.delete(
  '/me',
  [
    body('password').notEmpty().withMessage('Password is required'),
    body('otp_code').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const isPasswordValid = await req.user.authenticate(req.body.password);
      if (!isPasswordValid) {
        return res.status(422).json({ errors: ['resource.user.invalid_password'] });
      }

      if (req.user.otp) {
        if (!req.body.otp_code) {
          return res.status(422).json({ errors: ['resource.user.missing_otp_code'] });
        }

        const otpValid = await totpService.validate(req.user.uid, req.body.otp_code);
        if (!otpValid) {
          return res.status(422).json({ errors: ['resource.user.invalid_otp'] });
        }
      }

      await req.user.update({ state: 'deleted' });

      await logActivity({
        user_id: req.user.id,
        action: 'delete',
        result: 'succeed',
        topic: 'account',
        user_ip: req.ip,
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(200).json({ message: 'User blocked' });
    } catch (error) {
      logger.error('Delete user error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/resource/users/activity/{topic}:
 *   get:
 *     summary: Get user activity
 *     tags: [Resource]
 *     description: Get user activity logs by topic
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema:
 *           type: string
 *           enum: [all, session, otp, password, account]
 *         description: Activity topic filter
 *       - in: query
 *         name: time_from
 *         schema:
 *           type: integer
 *         description: Start timestamp (Unix)
 *       - in: query
 *         name: time_to
 *         schema:
 *           type: integer
 *         description: End timestamp (Unix)
 *       - in: query
 *         name: result
 *         schema:
 *           type: string
 *           enum: [succeed, failed]
 *         description: Filter by result
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Activity logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Activity'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/activity/:topic',
  [
    // Note: body() validators don't work for query params, using query() instead
  ],
  async (req, res, next) => {
    try {
      const { topic } = req.params;
      const allowedTopics = ['all', 'session', 'otp', 'password', 'account'];

      if (!allowedTopics.includes(topic)) {
        return res.status(422).json({ errors: ['resource.user.wrong_topic'] });
      }

      const where = { user_id: req.user.id };
      if (topic !== 'all') {
        where.topic = topic;
      }

      if (req.query.time_from) {
        where.created_at = { [require('sequelize').Op.gte]: new Date(parseInt(req.query.time_from) * 1000) };
      }

      if (req.query.time_to) {
        where.created_at = {
          ...where.created_at,
          [require('sequelize').Op.lt]: new Date(parseInt(req.query.time_to) * 1000),
        };
      }

      if (req.query.result) {
        where.result = req.query.result;
      }

      const activities = await Activity.findAll({
        where,
        order: [['id', 'DESC']],
        limit: parseInt(req.query.limit || '50'),
        offset: parseInt(req.query.offset || '0'),
      });

      if (activities.length === 0) {
        return res.status(422).json({ errors: ['resource.user.no_activity'] });
      }

      return res.json(activities);
    } catch (error) {
      logger.error('Get activity error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/resource/users/password:
 *   put:
 *     summary: Change password
 *     tags: [Resource]
 *     description: Change user password
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *               - confirm_password
 *             properties:
 *               old_password:
 *                 type: string
 *                 format: password
 *               new_password:
 *                 type: string
 *                 format: password
 *               confirm_password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password changed
 *       400:
 *         description: Invalid old password or passwords don't match
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error or weak password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/password',
  [
    body('old_password').notEmpty().withMessage('Old password is required'),
    body('new_password').notEmpty().withMessage('New password is required'),
    body('confirm_password').notEmpty().withMessage('Confirm password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { old_password, new_password, confirm_password } = req.body;

      if (new_password !== confirm_password) {
        await logActivity({
          user_id: req.user.id,
          action: 'password change',
          result: 'failed',
          topic: 'password',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'doesnt_match' }),
        });
        return res.status(422).json({ errors: ['resource.user.password_mismatch'] });
      }

      const isOldPasswordValid = await req.user.authenticate(old_password);
      if (!isOldPasswordValid) {
        await logActivity({
          user_id: req.user.id,
          action: 'password change',
          result: 'failed',
          topic: 'password',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'prev_pass_not_correct' }),
        });
        return res.status(400).json({ errors: ['resource.user.invalid_old_password'] });
      }

      if (old_password === new_password) {
        await logActivity({
          user_id: req.user.id,
          action: 'password change',
          result: 'failed',
          topic: 'password',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'no_change_provided' }),
        });
        return res.status(400).json({ errors: ['resource.user.password_no_change'] });
      }

      const passwordValidation = validatePassword(new_password);
      if (!passwordValidation.valid) {
        await logActivity({
          user_id: req.user.id,
          action: 'password change',
          result: 'failed',
          topic: 'password',
          user_ip: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
          data: JSON.stringify({ error_text: 'weak_password' }),
        });
        return res.status(422).json({ errors: ['resource.user.password_weak'] });
      }

      await req.user.update({ password: new_password });

      await logActivity({
        user_id: req.user.id,
        action: 'password change',
        result: 'succeed',
        topic: 'password',
        user_ip: req.ip,
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(201).json({ message: 'Password changed' });
    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }
);

module.exports = router;

