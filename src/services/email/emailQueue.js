const { Queue, Worker } = require('bullmq');
const logger = require('../../utils/logger');
const emailService = require('./emailService');
const templateService = require('./templateService');
const yaml = require('yaml');
const fs = require('fs').promises;
const path = require('path');

let emailQueue = null;
let emailWorker = null;
let mailerConfig = null;

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
  if (emailQueue) {
    return emailQueue;
  }

  emailQueue = new Queue('email', {
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

  logger.info('Email queue initialized');
  return emailQueue;
};

const loadMailerConfig = async () => {
  if (mailerConfig) {
    return mailerConfig;
  }

  try {
    const configPath = path.join(__dirname, '../../../config/mailer.yml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    mailerConfig = yaml.parse(configContent);
    logger.info('Mailer configuration loaded');
    return mailerConfig;
  } catch (error) {
    logger.error('Failed to load mailer config:', error);
    throw error;
  }
};

const getEventConfig = async (eventKey) => {
  const config = await loadMailerConfig();
  return config.events.find(event => event.key === eventKey);
};

const initializeWorker = () => {
  if (emailWorker) {
    return emailWorker;
  }

  emailWorker = new Worker(
    'email',
    async (job) => {
      const { eventKey, to, language, data, from, fromName } = job.data;

      try {
        const eventConfig = await getEventConfig(eventKey);
        if (!eventConfig) {
          throw new Error(`Event config not found for key: ${eventKey}`);
        }

        const lang = (language || 'en').toLowerCase();
        const templateConfig = eventConfig.templates[lang] || eventConfig.templates.en;

        if (!templateConfig) {
          throw new Error(`Template not found for language: ${lang}`);
        }

        const html = await templateService.render(templateConfig.template_path, {
          ...data,
          logo: process.env.SMTP_LOGO_LINK || data.logo,
          year: data.year || new Date().getFullYear(),
        });

        const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

        await emailService.sendEmail({
          to,
          subject: templateConfig.subject,
          html,
          text,
          from,
          fromName,
        });

        logger.info(`Email job ${job.id} processed successfully for ${to}`);
        return { success: true };
      } catch (error) {
        logger.error(`Email job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '5'),
      limiter: {
        max: parseInt(process.env.EMAIL_WORKER_MAX_JOBS || '10'),
        duration: 1000,
      },
    }
  );

  emailWorker.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed`);
  });

  emailWorker.on('failed', (job, err) => {
    logger.error(`Email job ${job.id} failed:`, err);
  });

  emailWorker.on('error', (err) => {
    logger.error('Email worker error:', err);
  });

  logger.info('Email worker initialized');
  return emailWorker;
};

const enqueueEmail = async ({ eventKey, to, language, data, from, fromName, priority }) => {
  const queue = initializeQueue();

  const job = await queue.add(
    'send-email',
    {
      eventKey,
      to,
      language,
      data,
      from,
      fromName,
    },
    {
      priority: priority || 0,
    }
  );

  logger.info(`Email job ${job.id} enqueued for ${to} (event: ${eventKey})`);
  return job;
};

const closeQueue = async () => {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
  logger.info('Email queue and worker closed');
};

module.exports = {
  initializeQueue,
  initializeWorker,
  enqueueEmail,
  closeQueue,
  getEventConfig,
};

