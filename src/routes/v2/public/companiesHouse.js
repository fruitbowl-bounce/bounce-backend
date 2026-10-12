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
const { requireFormToken } = require('../../../services/formToken');
const { dailyCap } = require('../../../services/usageLimits');

const UPSTREAM = 'https://api.company-information.service.gov.uk';

// Read-only passthrough, but still worth guarding our own Companies House
// quota from abuse — generous enough for Stage 1's debounced search-as-you-type.
const companiesHouseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { errors: ['public.companies_house.rate_limited'] },
});

// Calls on our API key, so the default leaves plenty of headroom under
// Companies House's own limit (600 calls per 5 minutes).
const companiesHouseDailyCap = dailyCap('companies_house', 'Companies House lookups', 'COMPANIES_HOUSE_DAILY_CAP', 5000);

// Only the lookups the application form makes: company search, a company's
// profile (for a UK branch's parent) and its officers.
const ALLOWED_PATHS = [
  /^\/search\/companies$/,
  /^\/company\/[A-Z0-9]{8}$/i,
  /^\/company\/[A-Z0-9]{8}\/officers$/i,
];
const allowedPath = (req, res, next) => (ALLOWED_PATHS.some((pattern) => pattern.test(req.path))
  ? next()
  : res.status(404).json({ errors: ['public.companies_house.not_found'] }));

/**
 * @swagger
 * /api/v2/nebryx/public/companies-house/{path}:
 *   get:
 *     summary: Proxy to the Companies House REST API
 *     tags: [Public]
 *     description: Server-side proxy that attaches the Companies House API key (as HTTP Basic auth) so it never reaches the browser. Only passes on /search/companies?q=..., /company/{number} and /company/{number}/officers, and only with a valid X-Form-Token header (see /human-check). Same design as the dev-only Vite proxy this replaces, so it also works in the production build.
 *     responses:
 *       200:
 *         description: Companies House response, passed through as-is
 *       403:
 *         description: Missing or expired form token
 *       404:
 *         description: Path not one the application form uses
 *       429:
 *         description: Rate limit or daily cap reached
 *       500:
 *         description: COMPANIES_HOUSE_API_KEY not configured
 *       502:
 *         description: Companies House unreachable
 */
router.get('/*', companiesHouseLimiter, allowedPath, requireFormToken, companiesHouseDailyCap, async (req, res) => {
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
