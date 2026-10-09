const logger = require('../../utils/logger');
const FormSubmissionReminderEmail = require('../../models/FormSubmissionReminderEmail');
const { sendEmail } = require('../email');
const { OFFERS_SHOWN_STAGE } = require('../salesforce/fieldMapper');

// "New application" email to the Bounce team inbox once an applicant reaches
// the offers page, as a plain list of what they entered (like the Gravity
// Forms emails they worked from before). A backup for when Salesforce is
// unavailable (Joshua/Matt, 09/10). Off unless TEAM_NOTIFICATION_EMAIL is
// set, so staging tests don't land in their real inbox.
const EMAIL_KEY = 'team_new_application';

const pounds = (value) => (value != null && value !== '' ? `£${Number(value).toLocaleString('en-GB')}` : '');
const ukTime = (date) => new Date(date).toLocaleString('en-GB', {
  timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const yesNo = (value) => (value == null ? '' : value ? 'Yes' : 'No');

const rowsFor = (s) => [
  ['Name', s.director_name],
  ['Email', s.email],
  ['Phone', s.phone],
  ['Home address', s.home_address],
  ['Company', [s.company_name, s.company_number && `(${s.company_number})`].filter(Boolean).join(' ')],
  ['Registered address', s.company_address],
  ['Amount', pounds(s.loan_amount)],
  ['Funding purpose', s.funding_purpose],
  ['Trading time', s.trading_time],
  ['Turnover', s.turnover_range],
  ['Owns UK property', yesNo(s.owns_property)],
  ['Offer selected', [s.offer_name, s.offer_apr, s.offer_term].filter(Boolean).join(', ') || 'Not yet'],
  ['Application ref', s.application_ref],
  ['Started', `${ukTime(s.created_at)} (UK time)`],
].map(([label, value]) => ({ label, value: value || '' }));

// Sends once per application. The row is written first (unique on
// form_submission_id + email_key) so two saves at the same moment can't
// both send; it's removed again if the email couldn't be queued.
const notifyNewApplication = async (submission) => {
  const to = process.env.TEAM_NOTIFICATION_EMAIL;
  if (!to || submission.funnel_stage < OFFERS_SHOWN_STAGE) return false;

  let record;
  try {
    record = await FormSubmissionReminderEmail.create({ form_submission_id: submission.id, email_key: EMAIL_KEY });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return false;
    throw error;
  }

  try {
    const protocol = process.env.APP_PROTOCOL || 'http';
    await sendEmail({
      eventKey: 'team.new_application',
      to,
      language: 'en',
      data: {
        applicationRef: submission.application_ref,
        companyName: submission.company_name || submission.email,
        amount: pounds(submission.loan_amount),
        rows: rowsFor(submission),
        adminUrl: process.env.APP_DOMAIN ? `${protocol}://${process.env.APP_DOMAIN}/admin` : null,
      },
    });
  } catch (error) {
    await record.destroy();
    throw error;
  }
  logger.info(`New application email queued for ${submission.application_ref}`);
  return true;
};

module.exports = { notifyNewApplication };
