const { Queue, Worker } = require('bullmq');
const logger = require('../../utils/logger');
const { runReminderCheck } = require('./reminderScheduler');

let reminderQueue = null;
let reminderWorker = null;

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

const TICK_JOB_NAME = 'check-reminders';

const initializeQueue = () => {
  if (reminderQueue) {
    return reminderQueue;
  }

  reminderQueue = new Queue('reminder-emails', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400 },
    },
  });

  logger.info('Reminder email queue initialized');
  return reminderQueue;
};

const initializeWorker = () => {
  if (reminderWorker) {
    return reminderWorker;
  }

  reminderWorker = new Worker(
    'reminder-emails',
    async (job) => {
      if (job.name !== TICK_JOB_NAME) return;
      await runReminderCheck();
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );

  reminderWorker.on('failed', (job, err) => {
    logger.error(`Reminder check job ${job?.id} failed:`, err);
  });

  reminderWorker.on('error', (err) => {
    logger.error('Reminder email worker error:', err);
  });

  logger.info('Reminder email worker initialized');
  return reminderWorker;
};

// Ticks on a fixed interval and re-evaluates every open submission against
// all 8 rules each time — cheap enough at this scale, and it means a rule
// that was skipped (Redis blip, transient DB error) just gets picked up on
// the next tick instead of being lost.
const scheduleRepeatingCheck = async () => {
  const queue = initializeQueue();
  const everyMs = parseInt(process.env.REMINDER_CHECK_INTERVAL_MS || `${15 * 60 * 1000}`);

  await queue.add(
    TICK_JOB_NAME,
    {},
    {
      repeat: { every: everyMs },
      jobId: TICK_JOB_NAME,
    }
  );

  logger.info(`Reminder email check scheduled every ${everyMs}ms`);
};

const closeQueue = async () => {
  if (reminderWorker) {
    await reminderWorker.close();
    reminderWorker = null;
  }
  if (reminderQueue) {
    await reminderQueue.close();
    reminderQueue = null;
  }
  logger.info('Reminder email queue and worker closed');
};

module.exports = {
  initializeQueue,
  initializeWorker,
  scheduleRepeatingCheck,
  closeQueue,
};
