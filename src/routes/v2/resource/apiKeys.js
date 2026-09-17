/**
 * @swagger
 * tags:
 *   - name: Resource
 *     description: User resource management endpoints (requires authentication)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const APIKey = require('../../../models/APIKey');
const crypto = require('crypto');
const { encrypt } = require('../../../services/encryptionService');
const logger = require('../../../utils/logger');

/**
 * @swagger
 * /api/v2/nebryx/resource/api_keys/me:
 *   get:
 *     summary: List API keys
 *     tags: [Resource]
 *     description: Get all API keys for current user
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/APIKey'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', async (req, res, next) => {
  try {
    const apiKeys = await APIKey.findAll({
      where: { key_holder_account_id: req.user.id },
    });

    const keysData = apiKeys.map(key => ({
      id: key.id,
      kid: key.kid,
      algorithm: key.algorithm,
      scope: key.scope,
      state: key.state,
      created_at: key.created_at,
      updated_at: key.updated_at,
    }));

    return res.json(keysData);
  } catch (error) {
    logger.error('Get API keys error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/resource/api_keys:
 *   post:
 *     summary: Create API key
 *     tags: [Resource]
 *     description: Create a new API key for programmatic access
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               algorithm:
 *                 type: string
 *                 enum: [HS256, HS384, HS512]
 *                 default: HS256
 *               scope:
 *                 type: string
 *                 description: API key scope/permissions
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kid:
 *                   type: string
 *                   description: Key identifier
 *                 secret:
 *                   type: string
 *                   description: API key secret (only shown once)
 *                 algorithm:
 *                   type: string
 *                 scope:
 *                   type: string
 *                 state:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('algorithm').optional().isIn(['HS256', 'HS384', 'HS512']),
    body('scope').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const kid = crypto.randomBytes(16).toString('hex');
      const secret = crypto.randomBytes(32).toString('hex');

      const apiKey = APIKey.build({
        key_holder_account_id: req.user.id,
        key_holder_account_type: 'User',
        kid,
        algorithm: req.body.algorithm || 'HS256',
        scope: req.body.scope || null,
        state: 'active',
      });
      apiKey.secret = secret;
      await apiKey.save();

      return res.status(201).json({
        kid: apiKey.kid,
        secret,
        algorithm: apiKey.algorithm,
        scope: apiKey.scope,
        state: apiKey.state,
      });
    } catch (error) {
      logger.error('Create API key error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/resource/api_keys/{kid}:
 *   delete:
 *     summary: Delete API key
 *     tags: [Resource]
 *     description: Delete (deactivate) an API key
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kid
 *         required: true
 *         schema:
 *           type: string
 *         description: Key identifier
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: API key deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:kid', async (req, res, next) => {
  try {
    const apiKey = await APIKey.findOne({
      where: {
        kid: req.params.kid,
        key_holder_account_id: req.user.id,
      },
    });

    if (!apiKey) {
      return res.status(404).json({ errors: ['resource.apikey.not_found'] });
    }

    await apiKey.update({ state: 'inactive' });

    return res.json({ message: 'API key deleted' });
  } catch (error) {
    logger.error('Delete API key error:', error);
    next(error);
  }
});

module.exports = router;

