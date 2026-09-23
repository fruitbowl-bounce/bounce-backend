const { Queue, Worker } = require('bullmq');
const logger = require('../../utils/logger');
const FormSubmission = require('../../models/FormSubmission');
const FormSubmissionDocument = require('../../models/FormSubmissionDocument');
const { upsertSubmission } = require('./salesforceClient');

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

      const salesforceId = await upsertSubmission(submission);

      await submission.update({
        salesforce_id: salesforceId,
        salesforce_synced_at: new Date(),
        status: 'synced_to_salesforce',
        salesforce_sync_error: null,
      });

      logger.info(`Salesforce sync job ${job.id} succeeded for form_submission ${formSubmissionId}`);
      return { salesforceId };
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
        });
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
  closeQueue,
};
