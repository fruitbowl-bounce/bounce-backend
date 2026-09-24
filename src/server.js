require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { initializeModels } = require('./models');
const { initializeProvider: initializeSmsProvider } = require('./services/sms/smsService');
const { initializeProvider: initializeEmailProvider, initializeQueue: initializeEmailQueue, initializeWorker: initializeEmailWorker } = require('./services/email');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const identityRoutes = require('./routes/v2/identity');
const resourceRoutes = require('./routes/v2/resource');
const publicRoutes = require('./routes/v2/public');
const adminRoutes = require('./routes/v2/admin');

const app = express();

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.connect().catch(logger.error);

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error('JSON parsing error:', err.message);
    return res.status(400).json({ errors: ['Invalid JSON in request body'] });
  }
  next(err);
});

app.use(cookieParser());
app.use(limiter);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_EXPIRE_TIME || '3600') * 1000,
  },
  name: 'nebryx.session',
}));

app.use('/api/v2/nebryx/identity', identityRoutes);
app.use('/api/v2/nebryx/resource', resourceRoutes);
app.use('/api/v2/nebryx/public', publicRoutes);
app.use('/api/v2/nebryx/admin', adminRoutes);

app.use('/api/v2/swagger', swaggerUi.serve);
app.get('/api/v2/swagger', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Nebryx API Documentation',
}));

app.get('/api/v2/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

if (process.env.STORAGE_TYPE === 'local') {
  const path = require('path');
  const express = require('express');
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Math.floor(Date.now() / 1000) });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// MySQL's own container can briefly answer healthchecks while its
// entrypoint is still swapping from the temporary init server to the real
// one — a fresh `docker compose up`/reboot can still hit us before the DB
// is truly ready. nodemon won't restart a crashed process on its own, so
// retry instead of dying on the first failed connection.
const connectWithRetry = async (attempts = 10, delayMs = 3000) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sequelize.authenticate();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      logger.warn(`Database not ready yet (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms:`, error.message);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

const startServer = async () => {
  try {
    await connectWithRetry();
    logger.info('Database connection established successfully');

    await initializeModels();
    logger.info('Models initialized');

    try {
      initializeSmsProvider();
      logger.info('SMS service initialized');
    } catch (smsError) {
      logger.warn('SMS service initialization failed (will use mock if configured):', smsError.message);
    }

    try {
      initializeEmailProvider();
      initializeEmailQueue();
      initializeEmailWorker();
      logger.info('Email service initialized');
    } catch (emailError) {
      logger.warn('Email service initialization failed (will use mock if configured):', emailError.message);
    }

    try {
      const { initializeProvider: initializeStorageProvider } = require('./services/storage/storageService');
      initializeStorageProvider();
      logger.info('Storage service initialized');
    } catch (storageError) {
      logger.warn('Storage service initialization failed:', storageError.message);
    }

    try {
      const { initializeQueue: initializeSalesforceQueue, initializeWorker: initializeSalesforceWorker } = require('./services/salesforce/salesforceQueue');
      initializeSalesforceQueue();
      initializeSalesforceWorker();
      logger.info('Salesforce sync service initialized');
    } catch (salesforceError) {
      logger.warn('Salesforce sync initialization failed:', salesforceError.message);
    }

    try {
      const { initializeQueue: initializeSendgridQueue, initializeWorker: initializeSendgridWorker } = require('./services/sendgrid/sendgridQueue');
      initializeSendgridQueue();
      initializeSendgridWorker();
      logger.info('SendGrid contact sync service initialized');
    } catch (sendgridError) {
      logger.warn('SendGrid contact sync initialization failed:', sendgridError.message);
    }

    try {
      const { initializeQueue: initializeReminderQueue, initializeWorker: initializeReminderWorker, scheduleRepeatingCheck } = require('./services/reminders/reminderQueue');
      initializeReminderQueue();
      initializeReminderWorker();
      await scheduleRepeatingCheck();
      logger.info('Reminder email service initialized');
    } catch (reminderError) {
      logger.warn('Reminder email initialization failed:', reminderError.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: false });
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      const { closeQueue } = require('./services/email');
      const { closeQueue: closeSalesforceQueue } = require('./services/salesforce/salesforceQueue');
      const { closeQueue: closeSendgridQueue } = require('./services/sendgrid/sendgridQueue');
      const { closeQueue: closeReminderQueue } = require('./services/reminders/reminderQueue');
      await closeQueue();
      await closeSalesforceQueue();
      await closeSendgridQueue();
      await closeReminderQueue();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      const { closeQueue } = require('./services/email');
      const { closeQueue: closeSalesforceQueue } = require('./services/salesforce/salesforceQueue');
      const { closeQueue: closeSendgridQueue } = require('./services/sendgrid/sendgridQueue');
      const { closeQueue: closeReminderQueue } = require('./services/reminders/reminderQueue');
      await closeQueue();
      await closeSalesforceQueue();
      await closeSendgridQueue();
      await closeReminderQueue();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

