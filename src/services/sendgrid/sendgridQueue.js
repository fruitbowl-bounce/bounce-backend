const { Queue, Worker } = require('bullmq');
const logger = require('../../utils/logger');
const FormSubmission = require('../../models/FormSubmission');
const { upsertContact } = require('./sendgridContacts');

let sendgridQueue = null;
let sendgridWorker = null;

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
  if (sendgridQueue) {
    return sendgridQueue;
  }

  sendgridQueue = new Queue('sendgrid-contact-sync', {
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

  logger.info('SendGrid contact sync queue initialized');
  return sendgridQueue;
};

const initializeWorker = () => {
  if (sendgridWorker) {
    return sendgridWorker;
  }

  sendgridWorker = new Worker(
    'sendgrid-contact-sync',
    async (job) => {
      const { formSubmissionId } = job.data;

      const submission = await FormSubmission.findByPk(formSubmissionId);
      if (!submission) {
        logger.warn(`SendGrid sync job ${job.id}: form_submission ${formSubmissionId} no longer exists`);
        return { skipped: true };
      }

      const jobId = await upsertContact(submission);
      logger.info(`SendGrid sync job ${job.id} succeeded for form_submission ${formSubmissionId}`);
      return { sendgridJobId: jobId };
    },
    {
      connection: getRedisConnection(),
      concurrency: parseInt(process.env.SENDGRID_WORKER_CONCURRENCY || '3'),
    }
  );

  sendgridWorker.on('completed', (job) => {
    logger.info(`SendGrid sync job ${job.id} completed`);
  });

  sendgridWorker.on('failed', (job, err) => {
    // Unlike Salesforce, this doesn't write a visible error onto the
    // submission row — contact sync is a nice-to-have for the reminder
    // journey, not something the admin panel needs to surface as a
    // blocking failure the way a failed CRM sync is.
    logger.error(`SendGrid sync job ${job?.id} failed:`, err);
  });

  sendgridWorker.on('error', (err) => {
    logger.error('SendGrid sync worker error:', err);
  });

  logger.info('SendGrid contact sync worker initialized');
  return sendgridWorker;
};

const enqueueSendgridSync = async (formSubmissionId) => {
  const queue = initializeQueue();
  const job = await queue.add('sync', { formSubmissionId });
  logger.info(`SendGrid sync job ${job.id} enqueued for form_submission ${formSubmissionId}`);
  return job;
};

const closeQueue = async () => {
  if (sendgridWorker) {
    await sendgridWorker.close();
    sendgridWorker = null;
  }
  if (sendgridQueue) {
    await sendgridQueue.close();
    sendgridQueue = null;
  }
  logger.info('SendGrid contact sync queue and worker closed');
};

module.exports = {
  initializeQueue,
  initializeWorker,
  enqueueSendgridSync,
  closeQueue,
};
