const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const Permission = require('../../../models/Permission');
const logger = require('../../../utils/logger');
const redis = require('redis');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.connect().catch(console.error);

const paginate = (page = 1, limit = 25) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset: parseInt(offset) };
};

const validVerbs = ['GET', 'POST', 'DELETE', 'PUT', 'HEAD', 'PATCH', 'ALL'];
const validActions = ['ACCEPT', 'DROP', 'AUDIT'];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { page = 1, limit = 25 } = req.query;
      const { limit: queryLimit, offset } = paginate(page, limit);

      const permissions = await Permission.findAndCountAll({
        limit: queryLimit,
        offset,
        order: [['id', 'ASC']],
      });

      return res.json({
        data: permissions.rows,
        meta: {
          page: parseInt(page),
          limit: queryLimit,
          total: permissions.count,
        },
      });
    } catch (error) {
      logger.error('Admin get permissions error:', error);
      next(error);
    }
  }
);

router.post(
  '/',
  [
    body('role').notEmpty().withMessage('Role is required'),
    body('verb').notEmpty().withMessage('Verb is required'),
    body('path').notEmpty().withMessage('Path is required'),
    body('action').notEmpty().withMessage('Action is required'),
    body('topic').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { role, verb, path, action, topic } = req.body;

      const upperVerb = verb.toUpperCase();
      const upperAction = action.toUpperCase();

      if (!validVerbs.includes(upperVerb)) {
        return res.status(422).json({ errors: ['admin.permissions.invalid_verb'] });
      }

      if (!validActions.includes(upperAction)) {
        return res.status(422).json({ errors: ['admin.permissions.invalid_action'] });
      }

      const existingPermission = await Permission.findOne({
        where: { role, verb: upperVerb, path },
      });

      if (existingPermission) {
        return res.status(422).json({ errors: ['admin.permission.already_exists'] });
      }

      const permission = await Permission.create({
        role,
        verb: upperVerb,
        path,
        action: upperAction,
        topic: topic || null,
      });

      await redisClient.del('permissions');

      return res.status(200).json({ message: 'Permission created', data: permission });
    } catch (error) {
      logger.error('Admin create permission error:', error);
      next(error);
    }
  }
);

router.put(
  '/:id',
  [
    body('role').optional().isString(),
    body('verb').optional().isString(),
    body('path').optional().isString(),
    body('action').optional().isString(),
    body('topic').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { id } = req.params;
      const { role, verb, path, action, topic } = req.body;

      const permission = await Permission.findByPk(id);
      if (!permission) {
        return res.status(404).json({ errors: ['admin.permission.doesnt_exist'] });
      }

      const updateData = {};
      if (role) updateData.role = role;
      if (verb) {
        const upperVerb = verb.toUpperCase();
        if (!validVerbs.includes(upperVerb)) {
          return res.status(422).json({ errors: ['admin.permissions.invalid_verb'] });
        }
        updateData.verb = upperVerb;
      }
      if (path) updateData.path = path;
      if (action) {
        const upperAction = action.toUpperCase();
        if (!validActions.includes(upperAction)) {
          return res.status(422).json({ errors: ['admin.permissions.invalid_action'] });
        }
        updateData.action = upperAction;
      }
      if (topic !== undefined) updateData.topic = topic;

      await permission.update(updateData);
      await redisClient.del('permissions');

      return res.status(200).json({ message: 'Permission updated', data: permission });
    } catch (error) {
      logger.error('Admin update permission error:', error);
      next(error);
    }
  }
);

router.delete(
  '/:id',
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const permission = await Permission.findByPk(id);
      if (!permission) {
        return res.status(404).json({ errors: ['admin.permission.doesnt_exist'] });
      }

      await permission.destroy();
      await redisClient.del('permissions');

      return res.status(200).json({ message: 'Permission deleted' });
    } catch (error) {
      logger.error('Admin delete permission error:', error);
      next(error);
    }
  }
);

module.exports = router;



