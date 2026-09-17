const twilio = require('twilio');
const logger = require('../../utils/logger');

class TwilioVerifyService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.serviceSid = process.env.TWILIO_SERVICE_SID;

    if (!this.accountSid || !this.authToken) {
      throw new Error('Invalid Twilio config: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }

    this.client = twilio(this.accountSid, this.authToken);
    this.verifyService = this.client.verify.v2.services(this.serviceSid);
  }

  async sendConfirmation(phone, channel = 'sms') {
    logger.info(`Sending code to ${phone.number} via ${channel}`);
    return await this.sendCode({
      number: phone.number,
      channel,
    });
  }

  async sendCode({ number, channel = 'sms' }) {
    try {
      const verification = await this.verifyService.verifications.create({
        to: `+${number}`,
        channel,
      });

      logger.info(`Verification code sent. SID: ${verification.sid}`);
      return { success: true, verificationSid: verification.sid };
    } catch (error) {
      logger.error('Twilio Verify send error:', error);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  }

  async verifyCode({ number, code, user }) {
    try {
      const verificationCheck = await this.verifyService.verificationChecks.create({
        to: `+${number}`,
        code,
      });

      const isValid = verificationCheck.status === 'approved';
      logger.info(`Verification check result for ${number}: ${verificationCheck.status}`);
      return isValid;
    } catch (error) {
      logger.error('Twilio Verify check error:', error);
      return false;
    }
  }
}

module.exports = TwilioVerifyService;



