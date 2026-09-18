/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { query, param, validationResult } = require('express-validator');
const logger = require('../../../utils/logger');

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const detailsUrl = (placeId) => `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

// Places API (New) — pure REST, so unlike the legacy JS Autocomplete widget
// the key never has to reach the browser. Attached server-side here and
// billed per session via the caller-supplied sessiontoken, same shape as
// the companies-house proxy this mirrors.
const placesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { errors: ['public.places.rate_limited'] },
});

function requireApiKey(res) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    res.status(500).json({ errors: ['public.places.not_configured'] });
    return false;
  }
  return true;
}

/**
 * @swagger
 * /api/v2/nebryx/public/places/autocomplete:
 *   get:
 *     summary: UK address autocomplete suggestions (Google Places API, New)
 *     tags: [Public]
 *     description: Server-side proxy to Places API (New) autocomplete, restricted to GB addresses. The API key is attached here so it never reaches the browser.
 *     parameters:
 *       - in: query
 *         name: input
 *         required: true
 *         schema: { type: string, minLength: 3 }
 *       - in: query
 *         name: sessiontoken
 *         schema: { type: string }
 *         description: Groups this call with the matching /details call for Google's per-session billing.
 *     responses:
 *       200:
 *         description: List of { placeId, description } suggestions
 */
router.get(
  '/autocomplete',
  placesLimiter,
  [query('input').isString().isLength({ min: 3 }), query('sessiontoken').optional().isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
    }
    if (!requireApiKey(res)) return;

    try {
      const upstreamRes = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify({
          input: req.query.input,
          includedRegionCodes: ['gb'],
          ...(req.query.sessiontoken ? { sessionToken: req.query.sessiontoken } : {}),
        }),
      });

      if (!upstreamRes.ok) {
        const errorBody = await upstreamRes.text();
        logger.error('Places autocomplete upstream error:', errorBody);
        return res.status(502).json({ errors: ['public.places.upstream_unreachable'] });
      }

      const body = await upstreamRes.json();
      const suggestions = (body.suggestions ?? [])
        .filter((s) => s.placePrediction)
        .map((s) => ({
          placeId: s.placePrediction.placeId,
          description: s.placePrediction.text?.text ?? '',
        }));

      res.json({ data: suggestions });
    } catch (error) {
      logger.error('Places autocomplete proxy error:', error);
      res.status(502).json({ errors: ['public.places.upstream_unreachable'] });
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/public/places/details/{placeId}:
 *   get:
 *     summary: Full formatted address for a place (Google Places API, New)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: placeId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: sessiontoken
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ formattedAddress }"
 */
router.get(
  '/details/:placeId',
  placesLimiter,
  [param('placeId').isString().notEmpty(), query('sessiontoken').optional().isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
    }
    if (!requireApiKey(res)) return;

    try {
      const url = new URL(detailsUrl(req.params.placeId));
      if (req.query.sessiontoken) url.searchParams.set('sessionToken', req.query.sessiontoken);

      const upstreamRes = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'formattedAddress',
        },
      });

      if (!upstreamRes.ok) {
        const errorBody = await upstreamRes.text();
        logger.error('Places details upstream error:', errorBody);
        return res.status(502).json({ errors: ['public.places.upstream_unreachable'] });
      }

      const body = await upstreamRes.json();
      res.json({ formattedAddress: body.formattedAddress ?? '' });
    } catch (error) {
      logger.error('Places details proxy error:', error);
      res.status(502).json({ errors: ['public.places.upstream_unreachable'] });
    }
  }
);

module.exports = router;
