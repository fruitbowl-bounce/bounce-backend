// Turns a submission's rows in form_submission_reminder_emails into a
// per-rule status for the admin panel: sent / not applicable at this stage /
// waiting on an earlier reminder in the sequence / scheduled for a future
// time / due (eligible, will send on the next scheduler tick).
const RULES = require('./reminderRules');
const { dueAtFor } = require('./reminderScheduler');

// reminderEmails: array of FormSubmissionReminderEmail rows for one submission
const computeEmailStatus = (submission, reminderEmails = []) => {
  const sentByKey = {};
  for (const row of reminderEmails) {
    sentByKey[row.email_key] = row;
  }

  return RULES.map((rule) => {
    const sent = sentByKey[rule.key];
    if (sent) {
      return { key: rule.key, label: rule.label, state: 'sent', sentAt: sent.sent_at };
    }

    if (!rule.stageMatch(submission.funnel_stage)) {
      return { key: rule.key, label: rule.label, state: 'not_applicable' };
    }

    if (rule.requiresPriorKey && !sentByKey[rule.requiresPriorKey]) {
      return { key: rule.key, label: rule.label, state: 'waiting_on_prior', requiresPriorKey: rule.requiresPriorKey };
    }

    const dueAt = dueAtFor(rule, submission, sentByKey[rule.requiresPriorKey]);
    const state = dueAt <= new Date() ? 'due' : 'scheduled';
    return { key: rule.key, label: rule.label, state, dueAt };
  });
};

const summarize = (statusList) => {
  const applicable = statusList.filter((s) => s.state !== 'not_applicable');
  const sent = applicable.filter((s) => s.state === 'sent');
  return { sent: sent.length, applicable: applicable.length };
};

module.exports = { computeEmailStatus, summarize };
