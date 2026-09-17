const sgMail = require('@sendgrid/mail');
const logger = require('../../utils/logger');

class SendgridEmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.from = process.env.SENDGRID_FROM || process.env.SENDGRID_FROM_EMAIL;
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Nebryx';

    if (!this.apiKey || !this.from) {
      throw new Error('Invalid SendGrid config: SENDGRID_API_KEY and SENDGRID_FROM are required');
    }

    sgMail.setApiKey(this.apiKey);
  }

  async sendEmail({ to, subject, html, text, from, fromName, attachments }) {
    try {
      const msg = {
        to: Array.isArray(to) ? to : [to],
        from: {
          email: from || this.from,
          name: fromName || this.fromName,
        },
        subject,
        html,
        text,
        attachments: attachments ? attachments.map(att => ({
          content: att.content,
          filename: att.filename,
          type: att.contentType,
          disposition: att.disposition || 'attachment',
        })) : undefined,
      };

      const [response] = await sgMail.send(msg);
      logger.info(`Email sent successfully to ${to}. MessageId: ${response.headers['x-message-id']}`);
      return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error) {
      logger.error('SendGrid email send error:', error);
      if (error.response) {
        logger.error('SendGrid error details:', error.response.body);
      }
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

module.exports = SendgridEmailService;

