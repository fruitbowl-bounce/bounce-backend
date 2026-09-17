const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

class SmtpEmailService {
  constructor() {
    this.host = process.env.SMTP_HOST;
    this.port = parseInt(process.env.SMTP_PORT || '587');
    this.secure = process.env.SMTP_SECURE === 'true';
    this.user = process.env.SMTP_USER;
    this.password = process.env.SMTP_PASSWORD;
    this.from = process.env.SMTP_FROM || process.env.SMTP_USER;
    this.fromName = process.env.SMTP_FROM_NAME || 'Nebryx';

    if (!this.host || !this.user || !this.password) {
      throw new Error('Invalid SMTP config: SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required');
    }

    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.password,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
      },
    });
  }

  async sendEmail({ to, subject, html, text, from, fromName, attachments }) {
    try {
      const mailOptions = {
        from: from || `${fromName || this.fromName} <${this.from || this.user}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text,
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('SMTP email send error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('SMTP verification failed:', error);
      return false;
    }
  }
}

module.exports = SmtpEmailService;

