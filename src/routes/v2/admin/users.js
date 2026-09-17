/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Administrative endpoints (requires admin authentication)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { Op } = require('sequelize');
const User = require('../../../models/User');
const Label = require('../../../models/Label');
const Profile = require('../../../models/Profile');
const { requireSuperadmin } = require('../../../middleware/adminAuth');
const logger = require('../../../utils/logger');

const paginate = (page = 1, limit = 25) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset: parseInt(offset) };
};

/**
 * @swagger
 * /api/v2/nebryx/admin/users:
 *   get:
 *     summary: List users (Admin)
 *     tags: [Admin]
 *     description: Get list of users with filtering and pagination (admin only)
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *         description: Number of records per page
 *       - in: query
 *         name: uid
 *         schema:
 *           type: string
 *         description: Filter by user UID
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state
 *       - in: query
 *         name: level
 *         schema:
 *           type: integer
 *         description: Filter by level
 *       - in: query
 *         name: extended
 *         schema:
 *           type: boolean
 *         description: Include extended user data
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin access required)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('uid').optional().isString(),
    query('email').optional().isString(),
    query('role').optional().isString(),
    query('state').optional().isString(),
    query('level').optional().isInt(),
    query('extended').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { page = 1, limit = 25, uid, email, role, state, level, extended } = req.query;
      const { limit: queryLimit, offset } = paginate(page, limit);

      const where = {};
      if (uid) where.uid = uid;
      if (email) where.email = email.toLowerCase().trim();
      if (role) where.role = role;
      if (state) where.state = state;
      if (level) where.level = parseInt(level);

      const users = await User.findAndCountAll({
        where,
        limit: queryLimit,
        offset,
        order: [['id', 'ASC']],
        include: extended === 'true' ? [{ model: Profile, as: 'profiles' }] : [],
      });

      const result = await Promise.all(users.rows.map(async user => {
        if (user.asJsonForEventApi) {
          return await user.asJsonForEventApi();
        }
        return user.toJSON();
      }));

      return res.json({
        data: result,
        meta: {
          page: parseInt(page),
          limit: queryLimit,
          total: users.count,
        },
      });
    } catch (error) {
      logger.error('Admin get users error:', error);
      next(error);
    }
  }
);

router.get(
  '/:uid',
  async (req, res, next) => {
    try {
      const { uid } = req.params;
      const user = await User.findOne({
        where: { uid },
        include: [
          { model: Profile, as: 'profiles' },
          { model: Label, as: 'labels' },
        ],
      });

      if (!user) {
        return res.status(404).json({ errors: ['admin.user.doesnt_exist'] });
      }

      return res.json(await user.asJsonForEventApi());
    } catch (error) {
      logger.error('Admin get user error:', error);
      next(error);
    }
  }
);

router.post(
  '/update',
  [
    body('uid').notEmpty().withMessage('UID is required'),
    body('state').optional().isString(),
    body('otp').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { uid, state, otp } = req.body;

      if (!state && otp === undefined) {
        return res.status(422).json({ errors: ['admin.user.one_of_state_otp'] });
      }

      const targetUser = await User.findOne({ where: { uid } });
      if (!targetUser) {
        return res.status(404).json({ errors: ['admin.user.doesnt_exist'] });
      }

      if (targetUser.superadmin() && !req.user.superadmin()) {
        return res.status(422).json({ errors: ['admin.user.superadmin_change'] });
      }

      if (targetUser.uid === req.user.uid) {
        return res.status(422).json({ errors: ['admin.user.update_himself'] });
      }

      if (otp === true) {
        return res.status(422).json({ errors: ['admin.user.enable_2fa'] });
      }

      const updateField = state !== undefined ? 'state' : 'otp';
      const updateValue = state !== undefined ? state : otp;

      if (targetUser[updateField] === updateValue) {
        return res.status(422).json({ errors: [`admin.user.${updateField}_no_change`] });
      }

      await targetUser.update({ [updateField]: updateValue });

      if (updateField === 'otp' && otp === false) {
        await Label.destroy({
          where: {
            user_id: targetUser.id,
            key: 'otp',
            scope: 'private',
          },
        });
      }

      return res.status(200).json({ message: 'User updated' });
    } catch (error) {
      logger.error('Admin update user error:', error);
      next(error);
    }
  }
);

router.post(
  '/role',
  [
    body('uid').notEmpty().withMessage('UID is required'),
    body('role').notEmpty().withMessage('Role is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { uid, role } = req.body;

      const targetUser = await User.findOne({ where: { uid } });
      if (!targetUser) {
        return res.status(404).json({ errors: ['admin.user.doesnt_exist'] });
      }

      if (targetUser.superadmin() && !req.user.superadmin()) {
        return res.status(422).json({ errors: ['admin.user.superadmin_change'] });
      }

      if (targetUser.uid === req.user.uid) {
        return res.status(422).json({ errors: ['admin.user.update_himself'] });
      }

      if (targetUser.role === role) {
        return res.status(422).json({ errors: ['admin.user.role_no_change'] });
      }

      await targetUser.update({ role });

      return res.status(200).json({ message: 'User role updated' });
    } catch (error) {
      logger.error('Admin update user role error:', error);
      next(error);
    }
  }
);

router.post(
  '/labels',
  [
    body('uid').notEmpty().withMessage('UID is required'),
    body('key').notEmpty().withMessage('Key is required'),
    body('value').notEmpty().withMessage('Value is required'),
    body('scope').optional().isString().default('public'),
    body('description').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { uid, key, value, scope = 'public', description } = req.body;

      const targetUser = await User.findOne({ where: { uid } });
      if (!targetUser) {
        return res.status(404).json({ errors: ['admin.user.doesnt_exist'] });
      }

      if (targetUser.superadmin() && !req.user.superadmin()) {
        return res.status(422).json({ errors: ['admin.user.superadmin_change'] });
      }

      const [label] = await Label.findOrCreate({
        where: {
          user_id: targetUser.id,
          key,
          scope,
        },
        defaults: {
          value,
          description,
        },
      });

      if (label.value !== value || (description && label.description !== description)) {
        label.value = value;
        if (description) label.description = description;
        await label.save();
      }

      return res.status(200).json({ message: 'Label created' });
    } catch (error) {
      logger.error('Admin create label error:', error);
      next(error);
    }
  }
);

router.delete(
  '/labels',
  [
    body('uid').notEmpty().withMessage('UID is required'),
    body('key').notEmpty().withMessage('Key is required'),
    body('scope').notEmpty().withMessage('Scope is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { uid, key, scope } = req.body;

      const targetUser = await User.findOne({ where: { uid } });
      if (!targetUser) {
        return res.status(404).json({ errors: ['admin.user.doesnt_exist'] });
      }

      if (targetUser.superadmin() && !req.user.superadmin()) {
        return res.status(422).json({ errors: ['admin.user.superadmin_change'] });
      }

      const label = await Label.findOne({
        where: {
          user_id: targetUser.id,
          key,
          scope,
        },
      });

      if (!label) {
        return res.status(404).json({ errors: ['admin.label.doesnt_exist'] });
      }

      await label.destroy();

      return res.status(200).json({ message: 'Label deleted' });
    } catch (error) {
      logger.error('Admin delete label error:', error);
      next(error);
    }
  }
);

module.exports = router;

