/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { sequelize } = require('../../../config/database');
const FormSubmission = require('../../../models/FormSubmission');
const FormSubmissionDirector = require('../../../models/FormSubmissionDirector');
const FormSubmissionDocument = require('../../../models/FormSubmissionDocument');
const storageService = require('../../../services/storage/storageService');
const { enqueueSalesforceSync } = require('../../../services/salesforce/salesforceQueue');
const logger = require('../../../utils/logger');

// Unauthenticated + writes to the DB, so it gets its own tighter limit on
// top of the global one in server.js.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { errors: ['public.applications.rate_limited'] },
});

// Multipart, not JSON: Stage 5 submits the form fields alongside the bank
// statement / filed accounts files in one request. Nested objects
// (selectedCompany/selectedOffer) arrive as JSON-encoded strings, see
// parseJsonFields below.
const uploadFields = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760') },
}).fields([
  { name: 'bankStatements', maxCount: 10 },
  { name: 'filedAccounts', maxCount: 10 },
]);

const parseJsonFields = (req, res, next) => {
  for (const field of ['selectedCompany', 'selectedOffer']) {
    if (typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch {
        return res.status(422).json({ errors: [`public.applications.invalid_${field}`] });
      }
    }
  }
  next();
};

const toBool = (v) => v === true || v === 'true';

const ALLOWED_EXTENSIONS = (process.env.UPLOAD_EXTENSIONS || 'pdf,jpg,jpeg,png')
  .split(',').map((ext) => ext.trim().toLowerCase());

const findInvalidExtension = (files) => {
  for (const file of files) {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return ext;
  }
  return null;
};

const uploadDocuments = async (files, docType, formSubmissionId) => {
  for (const file of files) {
    try {
      const uploadResult = await storageService.upload(file, { documentId: formSubmissionId });
      await FormSubmissionDocument.create({
        form_submission_id: formSubmissionId,
        doc_type: docType,
        original_filename: file.originalname,
        storage_key: uploadResult.path,
        mime_type: file.mimetype,
        size_bytes: file.size,
      });
    } catch (uploadError) {
      // A failed upload shouldn't sink an otherwise-valid application —
      // log it and move on; the applicant can be asked to resend later.
      logger.error(`Failed to upload ${docType} file for form_submission ${formSubmissionId}:`, uploadError);
    }
  }
};

/**
 * @swagger
 * /api/v2/nebryx/public/applications:
 *   post:
 *     summary: Submit a loan application (Bounce Funding funnel)
 *     tags: [Public]
 *     description: Stores a completed six-stage funnel submission, plus any bank statement / filed accounts documents. Fired once, from Stage 5's "Submit Documents" step.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data: {}
 *     responses:
 *       201:
 *         description: Application stored
 *       409:
 *         description: applicationRef already submitted
 *       422:
 *         description: Validation error
 */
router.post(
  '/',
  submitLimiter,
  uploadFields,
  parseJsonFields,
  [
    body('applicationRef').isString().trim().notEmpty().isLength({ max: 20 }),
    body('loanAmount').isFloat({ min: 0 }).withMessage('public.applications.invalid_loan_amount'),
    body('fundingPurpose').isString().trim().notEmpty(),
    body('email').isEmail().withMessage('public.applications.invalid_email'),
    body('marketingConsent').isBoolean(),
    body('tradingTime').isString().trim().notEmpty(),
    body('turnover').isString().trim().notEmpty(),
    body('director').isString().trim().notEmpty(),
    body('address').isString().trim().notEmpty(),
    body('phone').isString().trim().notEmpty(),
    body('ownsHouse').isIn(['Yes', 'No']).withMessage('public.applications.invalid_owns_house'),
    body('directorConfirm').custom((v) => toBool(v)).withMessage('public.applications.director_not_confirmed'),
    body('selectedCompany').isObject().withMessage('public.applications.missing_company'),
    body('selectedCompany.name').isString().trim().notEmpty(),
    body('selectedCompany.directors').optional().isArray(),
    body('selectedOffer').isObject().withMessage('public.applications.missing_offer'),
    body('selectedOffer.id').isString().trim().notEmpty(),
    body('selectedOffer.name').isString().trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const bankStatementFiles = req.files?.bankStatements || [];
      const filedAccountFiles = req.files?.filedAccounts || [];
      const invalidExt = findInvalidExtension([...bankStatementFiles, ...filedAccountFiles]);
      if (invalidExt) {
        return res.status(422).json({
          errors: [`public.applications.invalid_file_extension: .${invalidExt} not allowed (allowed: ${ALLOWED_EXTENSIONS.join(', ')})`],
        });
      }

      const {
        applicationRef, loanAmount, fundingPurpose, email, marketingConsent,
        tradingTime, turnover, director, address, phone, ownsHouse, directorConfirm,
        selectedCompany, selectedOffer,
      } = req.body;

      const existing = await FormSubmission.findOne({ where: { application_ref: applicationRef } });
      if (existing) {
        return res.status(409).json({ errors: ['public.applications.duplicate_ref'] });
      }

      const submission = await sequelize.transaction(async (t) => {
        const row = await FormSubmission.create({
          application_ref: applicationRef,
          loan_amount: loanAmount,
          funding_purpose: fundingPurpose,
          email: email.toLowerCase().trim(),
          marketing_consent: toBool(marketingConsent),
          trading_time: tradingTime,
          turnover_range: turnover,
          director_name: director,
          home_address: address,
          phone,
          owns_property: ownsHouse === 'Yes',
          director_confirmed: toBool(directorConfirm),
          company_external_id: selectedCompany.id || null,
          company_name: selectedCompany.name,
          company_number: selectedCompany.number || null,
          company_address: selectedCompany.address || null,
          offer_id: selectedOffer.id,
          offer_name: selectedOffer.name,
          offer_apr: selectedOffer.apr || null,
          offer_term: selectedOffer.term || null,
          offer_monthly_repayment: selectedOffer.monthlyRepayment || null,
          offer_max_amount: selectedOffer.maxAmount || null,
          offer_factor_rate: selectedOffer.factorRate ?? null,
          offer_tag: selectedOffer.tag || null,
          submitted_ip: req.ip,
          user_agent: req.headers['user-agent'] || null,
        }, { transaction: t });

        const directors = Array.isArray(selectedCompany.directors) ? selectedCompany.directors : [];
        if (directors.length) {
          await FormSubmissionDirector.bulkCreate(
            directors.map((name, index) => ({ form_submission_id: row.id, name, position: index })),
            { transaction: t }
          );
        }

        return row;
      });

      // File uploads happen after the row is committed — an upload hiccup
      // shouldn't roll back an otherwise-complete application.
      await uploadDocuments(bankStatementFiles, 'bank_statement', submission.id);
      await uploadDocuments(filedAccountFiles, 'filed_accounts', submission.id);

      // Fire-and-forget: never let a Salesforce/Redis hiccup fail the user's
      // submission response. A stuck job is retried from the admin panel.
      try {
        await enqueueSalesforceSync(submission.id);
      } catch (queueError) {
        logger.error('Failed to enqueue Salesforce sync job:', queueError);
      }

      return res.status(201).json({ applicationRef: submission.application_ref });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ errors: ['public.applications.duplicate_ref'] });
      }
      logger.error('Public application submit error:', error);
      next(error);
    }
  }
);

module.exports = router;
