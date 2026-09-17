const logger = require('../../utils/logger');

let smsProvider = null;
let providerInstance = null;

const initializeProvider = () => {
  if (providerInstance) {
    return providerInstance;
  }

  const phoneVerification = process.env.PHONE_VERIFICATION || 'mock';

  try {
    switch (phoneVerification) {
      case 'twilio_sms': {
        const TwilioSmsService = require('./twilioSmsService');
        providerInstance = new TwilioSmsService();
        logger.info('SMS Provider initialized: Twilio SMS');
        break;
      }
      case 'twilio_verify': {
        const TwilioVerifyService = require('./twilioVerifyService');
        providerInstance = new TwilioVerifyService();
        logger.info('SMS Provider initialized: Twilio Verify');
        break;
      }
      case 'aws_sns': {
        const AwsSnsService = require('./awsSnsService');
        providerInstance = new AwsSnsService();
        logger.info('SMS Provider initialized: AWS SNS');
        break;
      }
      case 'mock': {
        const MockSmsService = require('./mockSmsService');
        providerInstance = new MockSmsService();
        if (process.env.NODE_ENV === 'production') {
          logger.warn('WARNING! Using mock SMS service in production');
        } else {
          logger.info('SMS Provider initialized: Mock SMS');
        }
        break;
      }
      default:
        throw new Error(`Unknown phone verification service: ${phoneVerification}`);
    }

    smsProvider = phoneVerification;
    return providerInstance;
  } catch (error) {
    logger.error('Failed to initialize SMS provider:', error);
    throw error;
  }
};

const getProvider = () => {
  if (!providerInstance) {
    return initializeProvider();
  }
  return providerInstance;
};

const sendConfirmation = async (phone, channel = 'sms') => {
  const provider = getProvider();
  return await provider.sendConfirmation(phone, channel);
};

const sendSms = async ({ number, content }) => {
  const provider = getProvider();
  return await provider.sendSms({ number, content });
};

const verifyCode = async ({ number, code, user }) => {
  const provider = getProvider();
  return await provider.verifyCode({ number, code, user });
};

const resetProvider = () => {
  providerInstance = null;
  smsProvider = null;
};

module.exports = {
  sendConfirmation,
  sendSms,
  verifyCode,
  getProvider,
  resetProvider,
  initializeProvider,
};



