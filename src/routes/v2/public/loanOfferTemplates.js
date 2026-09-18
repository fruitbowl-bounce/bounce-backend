/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const LoanOfferTemplate = require('../../../models/LoanOfferTemplate');
const logger = require('../../../utils/logger');

/**
 * @swagger
 * /api/v2/nebryx/public/loan-offer-templates:
 *   get:
 *     summary: List active loan offer templates
 *     tags: [Public]
 *     description: Returns the funding options shown on Stage 4 of the application funnel, ordered for display. Amount and monthly repayment are computed client-side from the applicant's requested loan amount.
 *     responses:
 *       200:
 *         description: List of active loan offer templates
 */
router.get('/', async (req, res, next) => {
  try {
    const templates = await LoanOfferTemplate.findAll({
      where: { active: true },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    res.json({ data: templates.map((t) => t.asJson()) });
  } catch (error) {
    logger.error('Public list loan offer templates error:', error);
    next(error);
  }
});

module.exports = router;
