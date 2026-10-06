const { Queue, Worker } = require('bullmq');
const logger = require('../../utils/logger');
const FormSubmission = require('../../models/FormSubmission');
const { syncContact } = require('./brevoContacts');

let brevoQueue = null;
let brevoWorker = null;

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
  if (brevoQueue) {
    return brevoQueue;
  }

  brevoQueue = new Queue('brevo-contact-sync', {
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

  logger.info('Brevo contact sync queue initialized');
  return brevoQueue;
};

const initializeWorker = () => {
  if (brevoWorker) {
    return brevoWorker;
  }

  brevoWorker = new Worker(
    'brevo-contact-sync',
    async (job) => {
      const { formSubmissionId } = job.data;

      const submission = await FormSubmission.findByPk(formSubmissionId);
      if (!submission) {
        logger.warn(`Brevo sync job ${job.id}: form_submission ${formSubmissionId} no longer exists`);
        return { skipped: true };
      }

      const result = await syncContact(submission);
      logger.info(`Brevo sync job ${job.id} succeeded for form_submission ${formSubmissionId}`);
      return result;
    },
    {
      connection: getRedisConnection(),
      // One at a time, so a tick then an untick are applied in that order.
      concurrency: 1,
    }
  );

  brevoWorker.on('completed', (job) => {
    logger.info(`Brevo sync job ${job.id} completed`);
  });

  brevoWorker.on('failed', (job, err) => {
    // Marketing list only, so like SendGrid it's logged, not shown in the
    // admin panel.
    logger.error(`Brevo sync job ${job?.id} failed:`, err);
  });

  brevoWorker.on('error', (err) => {
    logger.error('Brevo sync worker error:', err);
  });

  logger.info('Brevo contact sync worker initialized');
  return brevoWorker;
};

const enqueueBrevoSync = async (formSubmissionId) => {
  const queue = initializeQueue();
  const job = await queue.add('sync', { formSubmissionId });
  logger.info(`Brevo sync job ${job.id} enqueued for form_submission ${formSubmissionId}`);
  return job;
};

const closeQueue = async () => {
  if (brevoWorker) {
    await brevoWorker.close();
    brevoWorker = null;
  }
  if (brevoQueue) {
    await brevoQueue.close();
    brevoQueue = null;
  }
  logger.info('Brevo contact sync queue and worker closed');
};

module.exports = {
  initializeQueue,
  initializeWorker,
  enqueueBrevoSync,
  closeQueue,
};
