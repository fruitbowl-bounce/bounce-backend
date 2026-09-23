/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const FormSubmissionDocument = require('../../../models/FormSubmissionDocument');
const storageService = require('../../../services/storage/storageService');
const logger = require('../../../utils/logger');

// This is the permanent link handed to Salesforce / put in emails. It never
// expires itself — every click looks up the document by its unguessable
// token and redirects to a brand new short-lived storage URL generated on
// the spot, so the link in Salesforce keeps working indefinitely even
// though the underlying signed URL behind it is only ever valid briefly.
const documentAccessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { errors: ['public.documents.rate_limited'] },
});

/**
 * @swagger
 * /api/v2/nebryx/public/documents/{token}:
 *   get:
 *     summary: Open an uploaded document via its permanent public link
 *     tags: [Public]
 *     description: No login required — the token itself is the access control. Redirects to a freshly generated, short-lived storage URL (signed S3 URL, or a local /uploads path).
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect to the file
 *       404:
 *         description: Not found
 */
router.get('/:token', documentAccessLimiter, async (req, res) => {
  try {
    const document = await FormSubmissionDocument.findOne({ where: { public_token: req.params.token } });
    if (!document) {
      return res.status(404).json({ errors: ['public.documents.not_found'] });
    }

    const url = await storageService.getUrl(document.storage_key, { documentId: document.form_submission_id });
    if (!url) {
      return res.status(404).json({ errors: ['public.documents.file_missing'] });
    }

    return res.redirect(302, url);
  } catch (error) {
    logger.error('Public document access error:', error);
    return res.status(500).json({ errors: ['public.documents.error'] });
  }
});

module.exports = router;
