const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const logger = require('../../utils/logger');

class AwsSnsService {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    this.smsContentTemplate = process.env.SMS_CONTENT_TEMPLATE || 'Your verification code for Nebryx: {{code}}';

    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error('Invalid AWS config: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
    }

    this.client = new SNSClient({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async sendConfirmation(phone, channel = 'sms') {
    logger.info(`Sending SMS to ${phone.number} via AWS SNS`);
    
    const content = this.smsContentTemplate.replace(/{{code}}/g, phone.code);
    return await this.sendSms({
      number: phone.number,
      content,
    });
  }

  async sendSms({ number, content }) {
    try {
      const params = {
        PhoneNumber: `+${number}`,
        Message: content,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      };

      const command = new PublishCommand(params);
      const result = await this.client.send(command);

      logger.info(`SMS sent successfully via AWS SNS. MessageId: ${result.MessageId}`);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      logger.error('AWS SNS SMS send error:', error);
      throw new Error(`Failed to send SMS via AWS SNS: ${error.message}`);
    }
  }

  async verifyCode({ number, code, user }) {
    const Phone = require('../../models/Phone');
    const phone = await Phone.findByNumber(number, { code, user_id: user.id });
    return !!phone;
  }
}

module.exports = AwsSnsService;



