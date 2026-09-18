/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Administrative endpoints (requires admin authentication)
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const LoanOfferTemplate = require('../../../models/LoanOfferTemplate');
const logger = require('../../../utils/logger');

const TAG_VARIANTS = ['recommended', 'value', 'fast'];

const rateValidators = [
  body('apr_value').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('factor_rate').optional({ nullable: true }).isFloat({ min: 0 }),
  body('term_months').isInt({ min: 1, max: 360 }),
  body('term_label').isString().trim().notEmpty(),
  body('name').isString().trim().notEmpty(),
  body('description').isString().trim().notEmpty(),
  body('features').isArray(),
  body('features.*').isString(),
  body('tag').optional({ nullable: true }).isString(),
  body('tag_variant').optional({ nullable: true }).isIn(TAG_VARIANTS),
  body('active').optional().isBoolean(),
];

function validateRatePair(req, res) {
  const { apr_value, factor_rate } = req.body;
  const hasApr = apr_value !== undefined && apr_value !== null;
  const hasFactor = factor_rate !== undefined && factor_rate !== null;
  if (hasApr === hasFactor) {
    res.status(422).json({ errors: ['admin.loan_offer_template.apr_xor_factor_rate'] });
    return false;
  }
  return true;
}

/**
 * @swagger
 * /api/v2/nebryx/admin/loan-offer-templates:
 *   get:
 *     summary: List loan offer templates (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: List of loan offer templates, including inactive ones, ordered by sort_order
 */
router.get('/', async (req, res, next) => {
  try {
    const templates = await LoanOfferTemplate.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    res.json({ data: templates.map((t) => t.asAdminJson()) });
  } catch (error) {
    logger.error('Admin list loan offer templates error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/admin/loan-offer-templates/{id}:
 *   get:
 *     summary: Get a loan offer template (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 */
router.get('/:id', [param('id').isInt()], async (req, res, next) => {
  try {
    const template = await LoanOfferTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ errors: ['admin.loan_offer_template.not_found'] });
    res.json(template.asAdminJson());
  } catch (error) {
    logger.error('Admin get loan offer template error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v2/nebryx/admin/loan-offer-templates:
 *   post:
 *     summary: Create a loan offer template (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 */
router.post(
  '/',
  [body('slug').isString().trim().matches(/^[a-z0-9-]+$/), ...rateValidators],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      if (!validateRatePair(req, res)) return;

      const existing = await LoanOfferTemplate.findOne({ where: { slug: req.body.slug } });
      if (existing) {
        return res.status(422).json({ errors: ['admin.loan_offer_template.slug_taken'] });
      }

      const maxSort = await LoanOfferTemplate.max('sort_order');
      const template = await LoanOfferTemplate.create({
        slug: req.body.slug,
        name: req.body.name,
        description: req.body.description,
        apr_value: req.body.apr_value ?? null,
        factor_rate: req.body.factor_rate ?? null,
        term_months: req.body.term_months,
        term_label: req.body.term_label,
        features: req.body.features,
        tag: req.body.tag ?? null,
        tag_variant: req.body.tag_variant ?? null,
        active: req.body.active ?? true,
        sort_order: Number.isFinite(maxSort) ? maxSort + 1 : 0,
      });

      res.status(201).json(template.asAdminJson());
    } catch (error) {
      logger.error('Admin create loan offer template error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/admin/loan-offer-templates/{id}:
 *   put:
 *     summary: Update a loan offer template (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 */
router.put(
  '/:id',
  [param('id').isInt(), ...rateValidators],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      if (!validateRatePair(req, res)) return;

      const template = await LoanOfferTemplate.findByPk(req.params.id);
      if (!template) return res.status(404).json({ errors: ['admin.loan_offer_template.not_found'] });

      await template.update({
        name: req.body.name,
        description: req.body.description,
        apr_value: req.body.apr_value ?? null,
        factor_rate: req.body.factor_rate ?? null,
        term_months: req.body.term_months,
        term_label: req.body.term_label,
        features: req.body.features,
        tag: req.body.tag ?? null,
        tag_variant: req.body.tag_variant ?? null,
        active: req.body.active ?? template.active,
      });

      res.json(template.asAdminJson());
    } catch (error) {
      logger.error('Admin update loan offer template error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/admin/loan-offer-templates/reorder:
 *   patch:
 *     summary: Reorder loan offer templates (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 */
router.patch(
  '/reorder',
  [body('ids').isArray({ min: 1 }), body('ids.*').isInt()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }

      const { ids } = req.body;
      await Promise.all(ids.map((id, index) => LoanOfferTemplate.update({ sort_order: index }, { where: { id } })));

      const templates = await LoanOfferTemplate.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
      res.json({ data: templates.map((t) => t.asAdminJson()) });
    } catch (error) {
      logger.error('Admin reorder loan offer templates error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/admin/loan-offer-templates/{id}:
 *   delete:
 *     summary: Delete a loan offer template (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 */
router.delete('/:id', [param('id').isInt()], async (req, res, next) => {
  try {
    const template = await LoanOfferTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ errors: ['admin.loan_offer_template.not_found'] });
    await template.destroy();
    res.status(204).send();
  } catch (error) {
    logger.error('Admin delete loan offer template error:', error);
    next(error);
  }
});

module.exports = router;
