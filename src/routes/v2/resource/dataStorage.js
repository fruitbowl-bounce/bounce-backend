const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const DataStorage = require('../../../models/DataStorage');
const logger = require('../../../utils/logger');

router.get('/me', async (req, res, next) => {
  try {
    const dataStorages = await DataStorage.findAll({
      where: { user_id: req.user.id },
    });

    return res.json(dataStorages);
  } catch (error) {
    logger.error('Get data storage error:', error);
    next(error);
  }
});

router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Title is required').isLength({ max: 64 }),
    body('data').notEmpty().withMessage('Data is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const [dataStorage, created] = await DataStorage.findOrCreate({
        where: {
          user_id: req.user.id,
          title: req.body.title,
        },
        defaults: {
          data: req.body.data,
        },
      });

      if (!created) {
        await dataStorage.update({ data: req.body.data });
      }

      return res.status(created ? 201 : 200).json(dataStorage);
    } catch (error) {
      logger.error('Create/Update data storage error:', error);
      next(error);
    }
  }
);

router.delete('/:title', async (req, res, next) => {
  try {
    const dataStorage = await DataStorage.findOne({
      where: {
        user_id: req.user.id,
        title: req.params.title,
      },
    });

    if (!dataStorage) {
      return res.status(404).json({ errors: ['resource.data_storage.not_found'] });
    }

    await dataStorage.destroy();

    return res.json({ message: 'Data storage deleted' });
  } catch (error) {
    logger.error('Delete data storage error:', error);
    next(error);
  }
});

module.exports = router;

