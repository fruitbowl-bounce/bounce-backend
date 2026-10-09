const { Queue, Worker } = require('bullmq');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const FormSubmission = require('../../models/FormSubmission');
const FormSubmissionDocument = require('../../models/FormSubmissionDocument');
const LoanOfferTemplate = require('../../models/LoanOfferTemplate');
const {
  upsertByRef, updateById, getById, findConversion, findExistingContact, convertLead,
} = require('./salesforceClient');
const {
  OFFERS_SHOWN_STAGE,
  DOCUMENTS_REQUIRED_STAGE,
  APPLICANT_STATUSES,
  documentsRequiredAfterMs,
  applicantStatusFor,
  isApplicantStatusAdvance,
  mapSubmissionToLead,
  mapSubmissionToOpportunity,
  mapSubmissionToContact,
  mapSubmissionToAccount,
  mapCompanyDetailsToAccount,
} = require('./fieldMapper');
const { fetchCompanyDetails } = require('../companiesHouse');

// Companies House details for the Account. A lookup failure (their API
// down, rate limited) shouldn't fail the whole sync, so the Account just
// keeps whatever it already has and the next sync tries again.
const companyDetailsFields = async (submission) => {
  if (!submission.company_number) return {};
  try {
    const details = await fetchCompanyDetails(submission.company_number);
    return details ? mapCompanyDetailsToAccount(details) : {};
  } catch (err) {
    logger.warn(`Companies House lookup failed for ${submission.application_ref}: ${err.message}`);
    return {};
  }
};

// Applicant_Status__c (BF-012). Read first, because brokers set their own
// later values by hand and those must never be overwritten; only a blank or
// an earlier portal value is moved forward. Written on its own, after the
// other fields, so a picklist mismatch can't block the rest of the sync.
// `salesforce_applicant_status` records the furthest status handled, so the
// read only happens when there's something new to set.
const syncApplicantStatus = async (submission, opportunityId) => {
  const next = applicantStatusFor(submission);
  const handled = APPLICANT_STATUSES.indexOf(submission.salesforce_applicant_status);
  if (!next || APPLICANT_STATUSES.indexOf(next) <= handled) return;

  const { Applicant_Status__c: current } = await getById('Opportunity', opportunityId, ['Applicant_Status__c']);
  if (isApplicantStatusAdvance(current, next)) {
    await updateById('Opportunity', opportunityId, { Applicant_Status__c: next });
  } else {
    logger.info(`Applicant status for ${submission.application_ref} left as "${current}" (portal would set "${next}")`);
  }
  await submission.update({ salesforce_applicant_status: next }, { silent: true });
};

const convertedIds = (lead) => (lead && lead.isConverted
  ? { opportunityId: lead.opportunityId, contactId: lead.contactId, accountId: lead.accountId }
  : null);

// Before conversion, every sync keeps the Lead current; once offers have
// been shown, the Lead is converted into an Account, Contact and
// Opportunity. Returns the Lead id and, if converted, the three new ids.
//
// A converted Lead can't be written to again, so the conversion state is
// re-checked in Salesforce first (a broker may have converted it by hand)
// and again after any failure: two sync jobs for the same application can
// run at once, and the one that loses the race sees its Lead write or
// conversion fail because the other job already converted it. Picking up
// that conversion instead of failing keeps this lock-free and idempotent.
const syncLead = async (submission, offerTemplates) => {
  const ref = submission.application_ref;
  const alreadyConverted = async () => {
    const lead = await findConversion(ref);
    return lead?.isConverted ? { leadId: lead.leadId, conversion: convertedIds(lead) } : null;
  };

  const existing = await alreadyConverted();
  if (existing) return existing;

  let leadId;
  try {
    leadId = await upsertByRef('Lead', ref, mapSubmissionToLead(submission, offerTemplates), submission.salesforce_lead_id);
  } catch (err) {
    const converted = await alreadyConverted();
    if (converted) return converted;
    throw err;
  }

  if (submission.funnel_stage < OFFERS_SHOWN_STAGE) return { leadId, conversion: null };

  // Same email at the same business = returning applicant: link to their
  // existing Contact and Account. The Opportunity is always new.
  const returning = await findExistingContact({
    email: submission.email,
    companyNumber: submission.company_number,
    companyName: submission.company_name,
  });
  // The ref in the name tells a returning applicant's Opportunities apart.
  const opportunityName = `${submission.company_name || submission.email} - ${ref}`.slice(0, 120);

  try {
    return { leadId, conversion: await convertLead({ leadId, ...returning, opportunityName }) };
  } catch (err) {
    const converted = await alreadyConverted();
    if (converted) return converted;
    throw err;
  }
};

let salesforceQueue = null;
let salesforceWorker = null;

const getRedisConnection = () => {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  if (process.env.REDIS_PASSWORD) {
    connection.password = process.env.REDIS_PASSWORD;
  }

  return connection;
};

const initializeQueue = () => {
  if (salesforceQueue) {
    return salesforceQueue;
  }

  salesforceQueue = new Queue('salesforce-sync', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });

  logger.info('Salesforce sync queue initialized');
  return salesforceQueue;
};

const initializeWorker = () => {
  if (salesforceWorker) {
    return salesforceWorker;
  }

  salesforceWorker = new Worker(
    'salesforce-sync',
    async (job) => {
      const { formSubmissionId } = job.data;

      const submission = await FormSubmission.findByPk(formSubmissionId, {
        include: [{ model: FormSubmissionDocument, as: 'documents' }],
      });
      if (!submission) {
        logger.warn(`Salesforce sync job ${job.id}: form_submission ${formSubmissionId} no longer exists`);
        return { skipped: true };
      }

      // Same active offers, in the same order, as the Stage 4 page shows.
      const offerTemplates = (await LoanOfferTemplate.findAll({
        where: { active: true },
        order: [['sort_order', 'ASC'], ['id', 'ASC']],
      })).map((t) => t.asJson());

      let leadId = submission.salesforce_lead_id;
      let conversion = submission.salesforce_opportunity_id ? {
        opportunityId: submission.salesforce_opportunity_id,
        contactId: submission.salesforce_contact_id,
        accountId: submission.salesforce_account_id,
      } : null;

      if (!conversion) {
        ({ leadId, conversion } = await syncLead(submission, offerTemplates));
        // Stored straight away so a failure in the writes below doesn't
        // lose track of records that now exist in Salesforce.
        await submission.update({
          salesforce_lead_id: leadId,
          salesforce_opportunity_id: conversion?.opportunityId ?? null,
          salesforce_contact_id: conversion?.contactId ?? null,
          salesforce_account_id: conversion?.accountId ?? null,
        }, { silent: true });
      }

      // After conversion the Lead is frozen: the deal goes on the
      // Opportunity, the person on the Contact, the business on the Account.
      if (conversion) {
        await updateById('Opportunity', conversion.opportunityId, mapSubmissionToOpportunity(submission, offerTemplates));
        await updateById('Contact', conversion.contactId, mapSubmissionToContact(submission));
        await updateById('Account', conversion.accountId, {
          ...mapSubmissionToAccount(submission),
          ...(await companyDetailsFields(submission)),
        });
        await syncApplicantStatus(submission, conversion.opportunityId);
      }

      await submission.update({
        salesforce_synced_at: new Date(),
        status: 'synced_to_salesforce',
        salesforce_sync_error: null,
      }, { silent: true });

      logger.info(`Salesforce sync job ${job.id} succeeded for form_submission ${formSubmissionId}`);
      return { leadId, opportunityId: conversion?.opportunityId ?? null };
    },
    {
      connection: getRedisConnection(),
      concurrency: parseInt(process.env.SALESFORCE_WORKER_CONCURRENCY || '3'),
    }
  );

  salesforceWorker.on('completed', (job) => {
    logger.info(`Salesforce sync job ${job.id} completed`);
  });

  // Once BullMQ has exhausted every retry for a job, persist the failure so
  // it's visible (and re-triable) from the admin panel instead of just the logs.
  salesforceWorker.on('failed', async (job, err) => {
    logger.error(`Salesforce sync job ${job?.id} failed:`, err);

    const attemptsExhausted = job && job.attemptsMade >= (job.opts.attempts || 1);
    if (!attemptsExhausted) return;

    try {
      const submission = await FormSubmission.findByPk(job.data.formSubmissionId);
      if (submission) {
        await submission.update({
          status: 'sync_failed',
          salesforce_sync_error: err.message,
        }, { silent: true });
      }
    } catch (updateError) {
      logger.error('Failed to record Salesforce sync failure on form_submission:', updateError);
    }
  });

  salesforceWorker.on('error', (err) => {
    logger.error('Salesforce sync worker error:', err);
  });

  logger.info('Salesforce sync worker initialized');
  return salesforceWorker;
};

const enqueueSalesforceSync = async (formSubmissionId) => {
  const queue = initializeQueue();
  const job = await queue.add('sync', { formSubmissionId });
  logger.info(`Salesforce sync job ${job.id} enqueued for form_submission ${formSubmissionId}`);
  return job;
};

// Applications that picked an offer 24+ hours ago and haven't submitted
// documents: queue a sync so the Opportunity moves to "Documents Required".
// Runs on the reminder tick; each application is queued once, since the sync
// records the status it handled.
const enqueueDocumentsRequiredSyncs = async () => {
  const overdue = await FormSubmission.findAll({
    attributes: ['id'],
    where: {
      funnel_stage: DOCUMENTS_REQUIRED_STAGE,
      offer_id: { [Op.ne]: null },
      salesforce_opportunity_id: { [Op.ne]: null },
      updated_at: { [Op.lte]: new Date(Date.now() - documentsRequiredAfterMs()) },
      [Op.or]: [
        { salesforce_applicant_status: null },
        { salesforce_applicant_status: { [Op.notIn]: ['Documents Required', 'Documents Received'] } },
      ],
    },
  });
  for (const { id } of overdue) await enqueueSalesforceSync(id);
};

const closeQueue = async () => {
  if (salesforceWorker) {
    await salesforceWorker.close();
    salesforceWorker = null;
  }
  if (salesforceQueue) {
    await salesforceQueue.close();
    salesforceQueue = null;
  }
  logger.info('Salesforce sync queue and worker closed');
};

module.exports = {
  initializeQueue,
  initializeWorker,
  enqueueSalesforceSync,
  enqueueDocumentsRequiredSyncs,
  closeQueue,
};
