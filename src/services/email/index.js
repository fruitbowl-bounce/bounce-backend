const emailService = require('./emailService');
const emailQueue = require('./emailQueue');

const sendEmail = async ({ eventKey, to, language, data, from, fromName, priority }) => {
  return await emailQueue.enqueueEmail({
    eventKey,
    to,
    language,
    data,
    from,
    fromName,
    priority,
  });
};

module.exports = {
  sendEmail,
  initializeProvider: emailService.initializeProvider,
  initializeQueue: emailQueue.initializeQueue,
  initializeWorker: emailQueue.initializeWorker,
  closeQueue: emailQueue.closeQueue,
  getEventConfig: emailQueue.getEventConfig,
};

