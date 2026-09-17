const logger = require('../../utils/logger');

let emailProvider = null;
let providerInstance = null;

const initializeProvider = () => {
  if (providerInstance) {
    return providerInstance;
  }

  const emailProviderType = process.env.EMAIL_PROVIDER || 'mock';

  try {
    switch (emailProviderType) {
      case 'smtp': {
        const SmtpEmailService = require('./smtpEmailService');
        providerInstance = new SmtpEmailService();
        logger.info('Email Provider initialized: SMTP');
        break;
      }
      case 'sendgrid': {
        const SendgridEmailService = require('./sendgridEmailService');
        providerInstance = new SendgridEmailService();
        logger.info('Email Provider initialized: SendGrid');
        break;
      }
      case 'mock': {
        const MockEmailService = require('./mockEmailService');
        providerInstance = new MockEmailService();
        if (process.env.NODE_ENV === 'production') {
          logger.warn('WARNING! Using mock email service in production');
        } else {
          logger.info('Email Provider initialized: Mock Email');
        }
        break;
      }
      default:
        throw new Error(`Unknown email provider: ${emailProviderType}`);
    }

    emailProvider = emailProviderType;
    return providerInstance;
  } catch (error) {
    logger.error('Failed to initialize email provider:', error);
    throw error;
  }
};

const getProvider = () => {
  if (!providerInstance) {
    return initializeProvider();
  }
  return providerInstance;
};

const sendEmail = async ({ to, subject, html, text, from, fromName, attachments }) => {
  const provider = getProvider();
  return await provider.sendEmail({ to, subject, html, text, from, fromName, attachments });
};

const resetProvider = () => {
  providerInstance = null;
  emailProvider = null;
};

module.exports = {
  sendEmail,
  getProvider,
  resetProvider,
  initializeProvider,
};

