/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();

const applicationsRouter = require('./applications');
router.use('/applications', applicationsRouter);

const companiesHouseRouter = require('./companiesHouse');
router.use('/companies-house', companiesHouseRouter);

const loanOfferTemplatesRouter = require('./loanOfferTemplates');
router.use('/loan-offer-templates', loanOfferTemplatesRouter);

const placesRouter = require('./places');
router.use('/places', placesRouter);

const documentAccessRouter = require('./documentAccess');
router.use('/documents', documentAccessRouter);

/**
 * @swagger
 * /api/v2/nebryx/public/ping:
 *   get:
 *     summary: Public health check
 *     tags: [Public]
 *     description: Simple ping endpoint for public access
 *     responses:
 *       200:
 *         description: API is available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ping:
 *                   type: string
 *                   example: pong
 */
router.get('/ping', (req, res) => {
  res.json({ ping: 'pong' });
});

module.exports = router;

