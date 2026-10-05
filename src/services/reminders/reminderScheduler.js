const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const FormSubmission = require('../../models/FormSubmission');
const FormSubmissionReminderEmail = require('../../models/FormSubmissionReminderEmail');
const { sendEmail } = require('../email');
const { resumeLink } = require('../../utils/links');
const RULES = require('./reminderRules');
const { nextSendTime } = require('./sendWindow');

const hoursFor = (rule) => parseFloat(process.env[rule.hoursEnvVar] ?? rule.defaultHours);

// When `rule` may go out for `submission`. `prior` is the sent row of
// rule.requiresPriorKey (needed for from: 'prior'). Reminders that fall due
// outside the send window are pushed to the next opening.
const dueAtFor = (rule, submission, prior, now = new Date()) => {
  const referenceTime = rule.from === 'prior' ? prior.sent_at : submission.updated_at;
  const dueAt = new Date(new Date(referenceTime).getTime() + hoursFor(rule) * 60 * 60 * 1000);
  if (!rule.quietHours) return dueAt;
  return nextSendTime(dueAt > now ? dueAt : now);
};

const firstNameOf = (fullName) => (fullName || '').trim().split(/\s+/)[0] || '';

const sendReminder = async (submission, rule) => {
  await sendEmail({
    eventKey: rule.eventKey,
    to: submission.email,
    language: 'en',
    data: {
      firstName: firstNameOf(submission.director_name),
      resumeLink: resumeLink(submission.resume_token),
      applicationRef: submission.application_ref,
      privacyPolicyUrl: process.env.PRIVACY_POLICY_URL || 'https://bouncefunding.co.uk/privacy-policy/',
    },
  });

  // Recorded after a successful enqueue, guarded by the unique index on
  // (form_submission_id, email_key) — if two ticks race for the same
  // submission, the loser's insert fails and we just skip it below.
  try {
    await FormSubmissionReminderEmail.create({
      form_submission_id: submission.id,
      email_key: rule.key,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      logger.warn(`Reminder "${rule.key}" for form_submission ${submission.id} already recorded, skipping duplicate`);
      return;
    }
    throw error;
  }

  logger.info(`Reminder "${rule.key}" sent for form_submission ${submission.id}`);
};

const processRule = async (rule) => {
  const alreadySent = await FormSubmissionReminderEmail.findAll({
    where: { email_key: rule.key },
    attributes: ['form_submission_id'],
  });
  const alreadySentIds = alreadySent.map((row) => row.form_submission_id);

  const where = { email: { [Op.ne]: null } };
  if (alreadySentIds.length) {
    where.id = { [Op.notIn]: alreadySentIds };
  }

  const candidates = await FormSubmission.findAll({ where });
  const now = new Date();

  for (const submission of candidates) {
    if (!rule.stageMatch(submission.funnel_stage)) continue;

    let prior = null;
    if (rule.requiresPriorKey) {
      prior = await FormSubmissionReminderEmail.findOne({
        where: { form_submission_id: submission.id, email_key: rule.requiresPriorKey },
      });
      if (!prior) continue;
    }

    if (dueAtFor(rule, submission, prior, now) > now) continue;

    try {
      await sendReminder(submission, rule);
    } catch (error) {
      logger.error(`Failed to send reminder "${rule.key}" for form_submission ${submission.id}:`, error);
    }
  }
};

const runReminderCheck = async () => {
  for (const rule of RULES) {
    try {
      await processRule(rule);
    } catch (error) {
      logger.error(`Reminder rule "${rule.key}" failed:`, error);
    }
  }
};

module.exports = { runReminderCheck, hoursFor, dueAtFor };
