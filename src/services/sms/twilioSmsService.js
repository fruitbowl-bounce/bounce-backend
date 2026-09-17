const twilio = require('twilio');
const logger = require('../../utils/logger');

class TwilioSmsService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550000';
    this.smsContentTemplate = process.env.SMS_CONTENT_TEMPLATE || 'Your verification code for Nebryx: {{code}}';

    if (!this.accountSid || !this.authToken) {
      throw new Error('Invalid Twilio config: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }

    this.client = twilio(this.accountSid, this.authToken);
  }

  async sendConfirmation(phone, channel = 'sms') {
    logger.info(`Sending SMS to ${phone.number}`);
    
    const content = this.smsContentTemplate.replace(/{{code}}/g, phone.code);
    return await this.sendSms({
      number: phone.number,
      content,
    });
  }

  async sendSms({ number, content }) {
    try {
      const message = await this.client.messages.create({
        from: this.phoneNumber,
        to: `+${number}`,
        body: content,
      });

      logger.info(`SMS sent successfully. SID: ${message.sid}`);
      return { success: true, messageSid: message.sid };
    } catch (error) {
      logger.error('Twilio SMS send error:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async verifyCode({ number, code, user }) {
    const Phone = require('../../models/Phone');
    const phone = await Phone.findByNumber(number, { code, user_id: user.id });
    return !!phone;
  }
}

module.exports = TwilioSmsService;



