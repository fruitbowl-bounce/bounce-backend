const logger = require('../../utils/logger');

class MockSmsService {
  constructor() {
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550000';
    this.smsContentTemplate = process.env.SMS_CONTENT_TEMPLATE || 'Your verification code for Nebryx: {{code}}';
    this.messages = [];
  }

  async sendConfirmation(phone, channel = 'sms') {
    logger.info(`[MOCK] Sending SMS to ${phone.number}`);
    
    const content = this.smsContentTemplate.replace(/{{code}}/g, phone.code);
    return await this.sendSms({
      number: phone.number,
      content,
    });
  }

  async sendSms({ number, content }) {
    const mockMessage = {
      from: this.phoneNumber,
      to: `+${number}`,
      body: content,
      timestamp: new Date().toISOString(),
    };

    this.messages.push(mockMessage);
    
    if (process.env.NODE_ENV === 'production') {
      logger.warn('WARNING! Using mock SMS service in production');
    }

    logger.info(`[MOCK] SMS would be sent: ${JSON.stringify(mockMessage)}`);
    return { success: true, messageId: `mock-${Date.now()}`, mock: true };
  }

  async verifyCode({ number, code, user }) {
    const Phone = require('../../models/Phone');
    const phone = await Phone.findByNumber(number, { user_id: user.id });
    return !!phone;
  }

  getMessages() {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
  }
}

module.exports = MockSmsService;



