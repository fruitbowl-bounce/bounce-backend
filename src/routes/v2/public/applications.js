/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: Public endpoints
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { sequelize } = require('../../../config/database');
const FormSubmission = require('../../../models/FormSubmission');
const FormSubmissionDirector = require('../../../models/FormSubmissionDirector');
const FormSubmissionDocument = require('../../../models/FormSubmissionDocument');
const storageService = require('../../../services/storage/storageService');
const { enqueueSalesforceSync } = require('../../../services/salesforce/salesforceQueue');
const { enqueueSendgridSync } = require('../../../services/sendgrid/sendgridQueue');
const logger = require('../../../utils/logger');
const { monthlyRepaymentFor } = require('../../../utils/offerMath');

// Unauthenticated + writes to the DB, so it gets its own tighter limit on
// top of the global one in server.js. Higher than before since a single
// applicant now calls this once per stage instead of once total.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: { errors: ['public.applications.rate_limited'] },
});

const resumeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { errors: ['public.applications.rate_limited'] },
});

// Multipart, not JSON: Stage 5 submits the form fields alongside the bank
// statement / filed accounts files in one request. Nested objects
// (selectedCompany/selectedOffer) arrive as JSON-encoded strings, see
// parseJsonFields below. Stages 1-4 send plain JSON with no files — multer's
// .fields() passes those straight through untouched.
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
        public_token: crypto.randomBytes(24).toString('hex'),
      });
    } catch (uploadError) {
      // A failed upload shouldn't sink an otherwise-valid application —
      // log it and move on; the applicant can be asked to resend later.
      logger.error(`Failed to upload ${docType} file for form_submission ${formSubmissionId}:`, uploadError);
    }
  }
};

// Only sets a column when the caller actually sent that field — a partial
// save from an earlier stage must never blank out data an earlier save
// already wrote (e.g. stage 2 saving shouldn't erase stage 1's loanAmount).
const setIfPresent = (target, body, bodyKey, column, transform = (v) => v) => {
  if (body[bodyKey] !== undefined) {
    target[column] = transform(body[bodyKey]);
  }
};

/**
 * @swagger
 * /api/v2/nebryx/public/applications/{applicationRef}:
 *   put:
 *     summary: Save or update a loan application (Bounce Funding funnel)
 *     tags: [Public]
 *     description: Called once per stage as the applicant progresses, not just at the end — creates the row on the first call (requires at least email) and fills in more fields on each subsequent call. Also accepts bank statement / filed accounts documents once the applicant reaches that stage.
 *     parameters:
 *       - in: path
 *         name: applicationRef
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data: {}
 *     responses:
 *       200:
 *         description: Application updated
 *       201:
 *         description: Application created
 *       422:
 *         description: Validation error
 */
router.put(
  '/:applicationRef',
  submitLimiter,
  uploadFields,
  parseJsonFields,
  [
    param('applicationRef').isString().trim().notEmpty().isLength({ max: 20 }),
    body('stage').isInt({ min: 1, max: 6 }).withMessage('public.applications.invalid_stage'),
    body('loanAmount').optional().isFloat({ min: 0 }).withMessage('public.applications.invalid_loan_amount'),
    body('fundingPurpose').optional().isString().trim().notEmpty(),
    body('email').optional().isEmail().withMessage('public.applications.invalid_email'),
    body('marketingConsent').optional().isBoolean(),
    body('tradingTime').optional().isString().trim().notEmpty(),
    body('turnover').optional().isString().trim().notEmpty(),
    body('director').optional().isString().trim().notEmpty(),
    body('address').optional().isString().trim().notEmpty(),
    body('phone').optional().isString().trim().notEmpty(),
    body('ownsHouse').optional().isIn(['Yes', 'No']).withMessage('public.applications.invalid_owns_house'),
    // Not "must be true" — that's a frontend rule (can't reach Stage 5
    // without checking it). Here it's just as valid a partial-save value as
    // false is on every earlier stage, before the applicant has answered it.
    body('directorConfirm').optional().isBoolean(),
    body('selectedCompany').optional().isObject().withMessage('public.applications.missing_company'),
    body('selectedCompany.directors').optional().isArray(),
    body('selectedOffer').optional().isObject().withMessage('public.applications.missing_offer'),
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

      const applicationRef = req.params.applicationRef;
      const { stage, selectedCompany, selectedOffer } = req.body;

      let submission = await FormSubmission.findOne({ where: { application_ref: applicationRef } });
      const isNew = !submission;

      if (isNew && !req.body.email) {
        return res.status(422).json({ errors: ['public.applications.email_required_for_new_application'] });
      }

      const result = await sequelize.transaction(async (t) => {
        const fields = {};
        setIfPresent(fields, req.body, 'loanAmount', 'loan_amount');
        setIfPresent(fields, req.body, 'fundingPurpose', 'funding_purpose');
        setIfPresent(fields, req.body, 'email', 'email', (v) => v.toLowerCase().trim());
        setIfPresent(fields, req.body, 'marketingConsent', 'marketing_consent', toBool);
        setIfPresent(fields, req.body, 'tradingTime', 'trading_time');
        setIfPresent(fields, req.body, 'turnover', 'turnover_range');
        setIfPresent(fields, req.body, 'director', 'director_name');
        setIfPresent(fields, req.body, 'address', 'home_address');
        setIfPresent(fields, req.body, 'phone', 'phone');
        setIfPresent(fields, req.body, 'ownsHouse', 'owns_property', (v) => v === 'Yes');
        setIfPresent(fields, req.body, 'directorConfirm', 'director_confirmed', toBool);

        if (selectedCompany) {
          fields.company_external_id = selectedCompany.id || null;
          if (selectedCompany.name) fields.company_name = selectedCompany.name;
          fields.company_number = selectedCompany.number || null;
          fields.company_address = selectedCompany.address || null;
        }

        if (selectedOffer) {
          fields.offer_id = selectedOffer.id;
          fields.offer_name = selectedOffer.name;
          fields.offer_apr = selectedOffer.apr || null;
          fields.offer_term = selectedOffer.term || null;
          fields.offer_monthly_repayment = selectedOffer.monthlyRepayment
            || monthlyRepaymentFor(fields.loan_amount ?? submission?.loan_amount, selectedOffer);
          fields.offer_max_amount = selectedOffer.maxAmount || null;
          fields.offer_factor_rate = selectedOffer.factorRate ?? null;
          fields.offer_tag = selectedOffer.tag || null;
        }

        fields.submitted_ip = req.ip;
        fields.user_agent = req.headers['user-agent'] || null;

        if (isNew) {
          submission = await FormSubmission.create({
            application_ref: applicationRef,
            resume_token: crypto.randomBytes(24).toString('hex'),
            funnel_stage: stage,
            ...fields,
          }, { transaction: t });
        } else {
          fields.funnel_stage = Math.max(submission.funnel_stage, parseInt(stage));
          await submission.update(fields, { transaction: t });
        }

        if (Array.isArray(selectedCompany?.directors) && selectedCompany.directors.length) {
          await FormSubmissionDirector.destroy({ where: { form_submission_id: submission.id }, transaction: t });
          await FormSubmissionDirector.bulkCreate(
            selectedCompany.directors.map((name, index) => ({ form_submission_id: submission.id, name, position: index })),
            { transaction: t }
          );
        }

        return submission;
      });

      await uploadDocuments(bankStatementFiles, 'bank_statement', result.id);
      await uploadDocuments(filedAccountFiles, 'filed_accounts', result.id);

      // Fire-and-forget on every save, not just the last one — Salesforce
      // upsert-by-Application-Ref is idempotent, so repeated calls just
      // keep the same record current as more data arrives.
      try {
        await enqueueSalesforceSync(result.id);
      } catch (queueError) {
        logger.error('Failed to enqueue Salesforce sync job:', queueError);
      }

      // Keeps the applicant's SendGrid contact (email nurture / reminder
      // journey) current the same way — same fire-and-forget, same
      // idempotent upsert-by-email design.
      try {
        await enqueueSendgridSync(result.id);
      } catch (queueError) {
        logger.error('Failed to enqueue SendGrid sync job:', queueError);
      }

      return res.status(isNew ? 201 : 200).json({ applicationRef: result.application_ref });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ errors: ['public.applications.duplicate_ref'] });
      }
      logger.error('Public application save error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/public/applications/resume/{resumeToken}:
 *   get:
 *     summary: Fetch saved progress for a "continue your application" link
 *     tags: [Public]
 *     description: No login required — the token itself is the access control. Used by the frontend to rebuild AppState and drop the applicant back into the funnel where they left off.
 *     parameters:
 *       - in: path
 *         name: resumeToken
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Saved application state
 *       404:
 *         description: Not found
 */
router.get('/resume/:resumeToken', resumeLimiter, async (req, res, next) => {
  try {
    const submission = await FormSubmission.findOne({
      where: { resume_token: req.params.resumeToken },
      include: [{ model: FormSubmissionDirector, as: 'directors' }],
    });

    if (!submission) {
      return res.status(404).json({ errors: ['public.applications.not_found'] });
    }

    return res.json({
      applicationRef: submission.application_ref,
      stage: submission.funnel_stage,
      loanAmount: submission.loan_amount ? String(submission.loan_amount) : '',
      selectedCompany: submission.company_name ? {
        id: submission.company_external_id || '',
        name: submission.company_name,
        number: submission.company_number || '',
        address: submission.company_address || '',
        directors: submission.directors.map((d) => d.name),
      } : null,
      fundingPurpose: submission.funding_purpose || '',
      email: submission.email || '',
      marketingConsent: submission.marketing_consent,
      tradingTime: submission.trading_time || '',
      turnover: submission.turnover_range || '',
      director: submission.director_name || '',
      address: submission.home_address || '',
      phone: submission.phone || '',
      ownsHouse: submission.owns_property === null ? '' : (submission.owns_property ? 'Yes' : 'No'),
      directorConfirm: submission.director_confirmed,
      selectedOffer: submission.offer_id ? {
        id: submission.offer_id,
        name: submission.offer_name,
        apr: submission.offer_apr,
        term: submission.offer_term,
        monthlyRepayment: submission.offer_monthly_repayment,
        maxAmount: submission.offer_max_amount,
        factorRate: submission.offer_factor_rate,
        tag: submission.offer_tag,
      } : null,
    });
  } catch (error) {
    logger.error('Public application resume error:', error);
    next(error);
  }
});

module.exports = router;
