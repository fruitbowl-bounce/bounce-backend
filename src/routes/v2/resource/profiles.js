/**
 * @swagger
 * tags:
 *   - name: Resource
 *     description: User resource management endpoints (requires authentication)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Profile = require('../../../models/Profile');
const logger = require('../../../utils/logger');

/**
 * @swagger
 * /api/v2/nebryx/resource/profiles/me:
 *   get:
 *     summary: Get user profiles
 *     tags: [Resource]
 *     description: Get all profiles for current user
 *     security:
 *       - SessionAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', async (req, res, next) => {
  try {
    const profiles = await Profile.findAll({
      where: { user_id: req.user.id },
    });

    const profilesData = profiles.map(profile => ({
      id: profile.id,
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      dob: profile.dob,
      address: profile.address,
      postcode: profile.postcode,
      city: profile.city,
      country: profile.country,
      state: profile.state,
      metadata: profile.metadata,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    }));

    return res.json(profilesData);
  } catch (error) {
    logger.error('Get profiles error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/resource/profiles:
 *   post:
 *     summary: Create profile
 *     tags: [Resource]
 *     description: Create a new profile for current user
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
 *               first_name:
 *                 type: string
 *                 maxLength: 255
 *               last_name:
 *                 type: string
 *                 maxLength: 255
 *               dob:
 *                 type: string
 *                 format: date
 *               address:
 *                 type: string
 *                 maxLength: 255
 *               postcode:
 *                 type: string
 *                 maxLength: 255
 *               city:
 *                 type: string
 *                 maxLength: 255
 *               country:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 3
 *               metadata:
 *                 type: object
 *               confirm:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Profile already exists
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
    body('first_name').optional().isLength({ min: 1, max: 255 }),
    body('last_name').optional().isLength({ min: 1, max: 255 }),
    body('dob').optional().isISO8601(),
    body('address').optional().isLength({ min: 1, max: 255 }),
    body('postcode').optional().isLength({ min: 2, max: 255 }),
    body('city').optional().isLength({ min: 1, max: 255 }),
    body('country').optional().isLength({ min: 2, max: 3 }),
    body('metadata').optional(),
    body('confirm').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const existingProfiles = await Profile.findAll({
        where: { user_id: req.user.id, state: [0, 1] },
      });

      if (existingProfiles.length > 0) {
        return res.status(409).json({ errors: ['resource.profile.already_exists'] });
      }

      const profileData = {
        user_id: req.user.id,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        dob: req.body.dob,
        address: req.body.address,
        postcode: req.body.postcode,
        city: req.body.city,
        country: req.body.country,
        metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : null,
        state: req.body.confirm ? 1 : 0,
      };

      const profile = await Profile.create(profileData);

      const savedProfile = await Profile.findByPk(profile.id);
      return res.status(201).json({
        id: savedProfile.id,
        user_id: savedProfile.user_id,
        first_name: savedProfile.first_name,
        last_name: savedProfile.last_name,
        dob: savedProfile.dob,
        address: savedProfile.address,
        postcode: savedProfile.postcode,
        city: savedProfile.city,
        country: savedProfile.country,
        state: savedProfile.state,
        metadata: savedProfile.metadata,
        created_at: savedProfile.created_at,
        updated_at: savedProfile.updated_at,
      });
    } catch (error) {
      logger.error('Create profile error:', error);
      next(error);
    }
  }
);

module.exports = router;

