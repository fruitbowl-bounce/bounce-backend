/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const logger = require('../../../utils/logger');
const {
  TOKEN_TTL_SECONDS, isConfigured, verifyTurnstile, issueFormToken,
} = require('../../../services/formToken');

// One check per page load, plus a fresh one when a token expires.
const humanCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { errors: ['public.human_check.rate_limited'] },
});

/**
 * @swagger
 * /api/v2/nebryx/public/human-check/config:
 *   get:
 *     summary: Turnstile site key for the application form
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: "{ siteKey }"
 *       500:
 *         description: Turnstile not configured
 */
router.get('/config', (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ errors: ['public.human_check.not_configured'] });
  }
  res.json({ siteKey: process.env.TURNSTILE_SITE_KEY });
});

/**
 * @swagger
 * /api/v2/nebryx/public/human-check:
 *   post:
 *     summary: Swap a Turnstile token for a form token
 *     tags: [Public]
 *     description: Checks the Cloudflare Turnstile token with Cloudflare and returns a signed form token. The form sends it as the X-Form-Token header on Companies House, address lookup and application saves.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: "{ formToken, expiresIn }"
 *       403:
 *         description: Turnstile check failed
 */
router.post(
  '/',
  humanCheckLimiter,
  [body('token').isString().notEmpty().isLength({ max: 2048 })],
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(422).json({ errors: ['public.human_check.token_required'] });
    }
    if (!isConfigured()) {
      return res.status(500).json({ errors: ['public.human_check.not_configured'] });
    }

    try {
      if (!(await verifyTurnstile(req.body.token, req.ip))) {
        return res.status(403).json({ errors: ['public.human_check.failed'] });
      }
      res.json({ formToken: issueFormToken(), expiresIn: TOKEN_TTL_SECONDS });
    } catch (error) {
      logger.error('Turnstile verification error:', error);
      res.status(502).json({ errors: ['public.human_check.upstream_unreachable'] });
    }
  }
);

module.exports = router;
