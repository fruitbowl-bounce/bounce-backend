const logger = require('../../utils/logger');

class MockEmailService {
  constructor() {
    this.from = process.env.SMTP_FROM || 'noreply@example.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'Nebryx';
    this.emails = [];
  }

  async sendEmail({ to, subject, html, text, from, fromName, attachments }) {
    const mockEmail = {
      from: from || `${this.fromName} <${this.from}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text,
      attachments,
      timestamp: new Date().toISOString(),
    };

    this.emails.push(mockEmail);

    if (process.env.NODE_ENV === 'production') {
      logger.warn('WARNING! Using mock email service in production');
    }

    logger.info(`[MOCK] Email would be sent: ${JSON.stringify({ to, subject, timestamp: mockEmail.timestamp })}`);
    return { success: true, messageId: `mock-${Date.now()}`, mock: true };
  }

  getEmails() {
    return this.emails;
  }

  clearEmails() {
    this.emails = [];
  }
}

module.exports = MockEmailService;

