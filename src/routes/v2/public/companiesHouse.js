/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const logger = require('../../../utils/logger');

const UPSTREAM = 'https://api.company-information.service.gov.uk';

// Read-only passthrough, but still worth guarding our own Companies House
// quota from abuse — generous enough for Stage 1's debounced search-as-you-type.
const companiesHouseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { errors: ['public.companies_house.rate_limited'] },
});

/**
 * @swagger
 * /api/v2/nebryx/public/companies-house/{path}:
 *   get:
 *     summary: Proxy to the Companies House REST API
 *     tags: [Public]
 *     description: Server-side proxy that attaches the Companies House API key (as HTTP Basic auth) so it never reaches the browser. Mirrors whatever path/query Companies House itself expects, e.g. /search/companies?q=... or /company/{number}/officers. Same design as the dev-only Vite proxy this replaces, so it also works in the production build.
 *     responses:
 *       200:
 *         description: Companies House response, passed through as-is
 *       500:
 *         description: COMPANIES_HOUSE_API_KEY not configured
 *       502:
 *         description: Companies House unreachable
 */
router.get('/*', companiesHouseLimiter, async (req, res) => {
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    return res.status(500).json({ errors: ['public.companies_house.not_configured'] });
  }

  try {
    const upstreamRes = await fetch(`${UPSTREAM}${req.url}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.COMPANIES_HOUSE_API_KEY}:`).toString('base64'),
      },
    });

    const body = await upstreamRes.text();
    res.status(upstreamRes.status);
    res.set('Content-Type', upstreamRes.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (error) {
    logger.error('Companies House proxy error:', error);
    res.status(502).json({ errors: ['public.companies_house.upstream_unreachable'] });
  }
});

module.exports = router;
