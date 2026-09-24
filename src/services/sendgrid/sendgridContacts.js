const logger = require('../../utils/logger');
const { resumeLink } = require('../../utils/links');

const isConfigured = () => Boolean(process.env.SENDGRID_API_KEY);

// SendGrid's Contacts API addresses custom fields by their generated field
// ID (not by name) — these only exist once the fields are created by hand
// in Marketing > Contacts > Custom Fields (see the setup guide). Any field
// whose ID isn't configured yet is just skipped, so this works fine even
// if only some of the fields have been set up so far.
const buildCustomFields = (submission, resumeLink) => {
  const fields = {};

  if (process.env.SENDGRID_FIELD_APPLICATION_REF) {
    fields[process.env.SENDGRID_FIELD_APPLICATION_REF] = submission.application_ref;
  }
  if (process.env.SENDGRID_FIELD_FUNNEL_STAGE) {
    fields[process.env.SENDGRID_FIELD_FUNNEL_STAGE] = submission.funnel_stage;
  }
  if (process.env.SENDGRID_FIELD_RESUME_LINK && resumeLink) {
    fields[process.env.SENDGRID_FIELD_RESUME_LINK] = resumeLink;
  }
  if (process.env.SENDGRID_FIELD_LAST_SAVED_AT) {
    // SendGrid Date fields only accept RFC3339, MM/DD/YYYY, or M/D/YYYY —
    // a plain YYYY-MM-DD string is rejected outright. Full ISO timestamp
    // (toISOString(), unsliced) is valid RFC3339.
    fields[process.env.SENDGRID_FIELD_LAST_SAVED_AT] = new Date().toISOString();
  }

  return fields;
};


// PUT /v3/marketing/contacts creates-or-updates by email, same idempotent
// upsert shape as the Salesforce sync — safe to call again on every save.
// It's async on SendGrid's side (202 + a job_id, not immediate), so there's
// nothing further to poll here, just fire it and move on.
const upsertContact = async (submission) => {
  if (!submission.email) return null;

  if (!isConfigured()) {
    throw new Error('SendGrid is not configured (SENDGRID_API_KEY missing)');
  }

  const link = resumeLink(submission.resume_token);
  const customFields = buildCustomFields(submission, link);

  // Adding the contact to this list is what should trigger the reminder
  // automation inside SendGrid ("when a contact is added to this list") —
  // the automation itself then runs entirely on SendGrid's side from there,
  // reading the custom fields above on each wait/check step.
  const payload = { contacts: [{ email: submission.email, custom_fields: customFields }] };
  if (process.env.SENDGRID_LIST_ID) {
    payload.list_ids = [process.env.SENDGRID_LIST_ID];
  }

  const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 202) {
    const text = await response.text();
    throw new Error(`SendGrid contact upsert failed (${response.status}): ${text}`);
  }

  const body = await response.json();
  logger.info(`SendGrid contact upsert accepted, job_id ${body.job_id}`);
  return body.job_id;
};

module.exports = { upsertContact, isConfigured };
