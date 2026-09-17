const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Activity = require('../../../models/Activity');
const User = require('../../../models/User');
const logger = require('../../../utils/logger');

const paginate = (page = 1, limit = 25) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset: parseInt(offset) };
};

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isString(),
    query('uid').optional().isString(),
    query('email').optional().isString(),
    query('topic').optional().isString(),
    query('from').optional().isInt(),
    query('to').optional().isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const { page = 1, limit = 25, action, uid, email, topic, from, to } = req.query;
      const { limit: queryLimit, offset } = paginate(page, limit);

      const where = { category: 'user' };
      if (action) where.action = action;
      if (topic) where.topic = topic;

      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(parseInt(from) * 1000);
        if (to) where.created_at[Op.lte] = new Date(parseInt(to) * 1000);
      }

      let activities;
      if (uid || email) {
        const userWhere = {};
        if (uid) userWhere.uid = uid;
        if (email) userWhere.email = email.toLowerCase().trim();

        const users = await User.findAll({ where: userWhere });
        const userIds = users.map(u => u.id);

        if (userIds.length > 0) {
          where.user_id = { [Op.in]: userIds };
          activities = await Activity.findAndCountAll({
            where,
            limit: queryLimit,
            offset,
            order: [['id', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['uid', 'email', 'role'] }],
          });
        } else {
          activities = { rows: [], count: 0 };
        }
      } else {
        activities = await Activity.findAndCountAll({
          where,
          limit: queryLimit,
          offset,
          order: [['id', 'DESC']],
          include: [{ model: User, as: 'user', attributes: ['uid', 'email', 'role'] }],
        });
      }

      return res.json({
        data: activities.rows,
        meta: {
          page: parseInt(page),
          limit: queryLimit,
          total: activities.count,
        },
      });
    } catch (error) {
      logger.error('Admin get activities error:', error);
      next(error);
    }
  }
);

module.exports = router;



