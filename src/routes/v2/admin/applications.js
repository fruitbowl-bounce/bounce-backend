/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Administrative endpoints (requires admin authentication)
 */

const express = require('express');
const router = express.Router();
const { query, param, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const FormSubmission = require('../../../models/FormSubmission');
const FormSubmissionDirector = require('../../../models/FormSubmissionDirector');
const FormSubmissionDocument = require('../../../models/FormSubmissionDocument');
const FormSubmissionReminderEmail = require('../../../models/FormSubmissionReminderEmail');
const storageService = require('../../../services/storage/storageService');
const { enqueueSalesforceSync } = require('../../../services/salesforce/salesforceQueue');
const { computeEmailStatus, summarize } = require('../../../services/reminders/reminderStatus');
const logger = require('../../../utils/logger');

const paginate = (page = 1, limit = 25) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset: parseInt(offset) };
};

const SORTABLE_FIELDS = ['created_at', 'loan_amount', 'email'];

/**
 * @swagger
 * /api/v2/nebryx/admin/applications:
 *   get:
 *     summary: List submitted loan applications (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *       - in: query
 *         name: company_number
 *         schema: { type: string }
 *       - in: query
 *         name: application_ref
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: date_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: date_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "created_at:desc" }
 *     responses:
 *       200:
 *         description: List of applications
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('email').optional().isString(),
    query('company_number').optional().isString(),
    query('application_ref').optional().isString(),
    query('status').optional().isString(),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
    query('sort').optional().matches(/^[a-z_]+:(asc|desc)$/i),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const {
        page = 1, limit = 25, email, company_number, application_ref, status,
        date_from, date_to, sort,
      } = req.query;
      const { limit: queryLimit, offset } = paginate(page, limit);

      const where = {};
      if (email) where.email = { [Op.like]: `%${email.toLowerCase().trim()}%` };
      if (company_number) where.company_number = company_number.trim();
      if (application_ref) where.application_ref = application_ref.trim();
      if (status) where.status = status;

      if (date_from || date_to) {
        where.created_at = {};
        if (date_from) where.created_at[Op.gte] = new Date(date_from);
        if (date_to) where.created_at[Op.lte] = new Date(date_to);
      }

      let orderField = 'created_at';
      let orderDir = 'DESC';
      if (sort) {
        const [field, dir] = sort.split(':');
        if (SORTABLE_FIELDS.includes(field)) {
          orderField = field;
          orderDir = dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        }
      }

      const result = await FormSubmission.findAndCountAll({
        where,
        limit: queryLimit,
        offset,
        order: [[orderField, orderDir]],
      });

      const ids = result.rows.map((row) => row.id);
      const reminderEmails = ids.length
        ? await FormSubmissionReminderEmail.findAll({ where: { form_submission_id: { [Op.in]: ids } } })
        : [];
      const reminderEmailsBySubmission = {};
      for (const row of reminderEmails) {
        (reminderEmailsBySubmission[row.form_submission_id] ||= []).push(row);
      }

      const data = result.rows.map((row) => {
        const plain = row.toJSON();
        plain.email_summary = summarize(computeEmailStatus(row, reminderEmailsBySubmission[row.id] || []));
        return plain;
      });

      return res.json({
        data,
        meta: {
          page: parseInt(page),
          limit: queryLimit,
          total: result.count,
        },
      });
    } catch (error) {
      logger.error('Admin list applications error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/admin/applications/{id}:
 *   get:
 *     summary: Get a submitted loan application (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Application detail
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  [param('id').isInt()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const submission = await FormSubmission.findByPk(req.params.id, {
        include: [
          { model: FormSubmissionDirector, as: 'directors' },
          { model: FormSubmissionDocument, as: 'documents' },
          { model: FormSubmissionReminderEmail, as: 'reminderEmails' },
        ],
      });

      if (!submission) {
        return res.status(404).json({ errors: ['admin.applications.not_found'] });
      }

      const plain = submission.toJSON();
      plain.email_status = computeEmailStatus(submission, submission.reminderEmails);

      return res.json(plain);
    } catch (error) {
      logger.error('Admin get application error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/admin/applications/{id}/retry-sync:
 *   post:
 *     summary: Re-enqueue the Salesforce sync job for an application (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       202:
 *         description: Sync job re-enqueued
 *       404:
 *         description: Not found
 */
router.post(
  '/:id/retry-sync',
  [param('id').isInt()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const submission = await FormSubmission.findByPk(req.params.id);
      if (!submission) {
        return res.status(404).json({ errors: ['admin.applications.not_found'] });
      }

      await submission.update({ status: 'new', salesforce_sync_error: null });
      await enqueueSalesforceSync(submission.id);

      return res.status(202).json({ status: submission.status });
    } catch (error) {
      logger.error('Admin retry-sync error:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v2/nebryx/admin/applications/{id}/documents/{docId}/url:
 *   get:
 *     summary: Get a viewable/download URL for an uploaded document (Admin)
 *     tags: [Admin]
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: URL to view/download the document (a signed S3 URL, or a local /uploads path)
 *       404:
 *         description: Not found
 */
router.get(
  '/:id/documents/:docId/url',
  [param('id').isInt(), param('docId').isInt()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const document = await FormSubmissionDocument.findOne({
        where: { id: req.params.docId, form_submission_id: req.params.id },
      });
      if (!document) {
        return res.status(404).json({ errors: ['admin.applications.document_not_found'] });
      }

      const url = await storageService.getUrl(document.storage_key, { documentId: document.form_submission_id });
      if (!url) {
        return res.status(404).json({ errors: ['admin.applications.document_file_missing'] });
      }

      return res.json({ url });
    } catch (error) {
      logger.error('Admin get document URL error:', error);
      next(error);
    }
  }
);

module.exports = router;
