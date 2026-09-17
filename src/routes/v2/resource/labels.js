const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Label = require('../../../models/Label');
const logger = require('../../../utils/logger');

router.get('/me', async (req, res, next) => {
  try {
    const scope = req.query.scope || 'public';
    const labels = await Label.findAll({
      where: { user_id: req.user.id, scope },
    });

    return res.json(labels);
  } catch (error) {
    logger.error('Get labels error:', error);
    next(error);
  }
});

router.post(
  '/',
  [
    body('key').notEmpty().withMessage('Key is required'),
    body('value').notEmpty().withMessage('Value is required'),
    body('scope').optional().isIn(['public', 'private']),
    body('description').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const [label, created] = await Label.findOrCreate({
        where: {
          user_id: req.user.id,
          key: req.body.key,
          scope: req.body.scope || 'public',
        },
        defaults: {
          value: req.body.value,
          description: req.body.description || null,
        },
      });

      if (!created) {
        await label.update({
          value: req.body.value,
          description: req.body.description || null,
        });
      }

      return res.status(created ? 201 : 200).json(label);
    } catch (error) {
      logger.error('Create/Update label error:', error);
      next(error);
    }
  }
);

module.exports = router;

