const logger = require('../../utils/logger');
const { splitName } = require('../salesforce/fieldMapper');

const API = 'https://api.brevo.com/v3';

const isConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID);

const brevoFetch = (path, body) => fetch(`${API}${path}`, {
  method: 'POST',
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(body),
});

// FIRSTNAME, LASTNAME and FIRM (company) are attributes that already exist
// in Matt's Brevo account.
// Blank values are left out so a Stage 1 save doesn't wipe the names.
const buildAttributes = (submission) => {
  const { firstName, lastName } = splitName(submission.director_name);
  const attributes = {};
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;
  const companyAttribute = process.env.BREVO_ATTRIBUTE_COMPANY || 'FIRM';
  if (submission.company_name) attributes[companyAttribute] = submission.company_name;
  return attributes;
};

// Creates the contact or updates it by email, and adds it to the list.
const addToList = async (submission) => {
  const response = await brevoFetch('/contacts', {
    email: submission.email,
    attributes: buildAttributes(submission),
    listIds: [Number(process.env.BREVO_LIST_ID)],
    updateEnabled: true,
  });
  if (response.status !== 201 && response.status !== 204) {
    throw new Error(`Brevo contact upsert failed (${response.status}): ${await response.text()}`);
  }
};

// Takes the email off our list only. The contact stays in Brevo, in case
// they're on Matt's other lists.
const removeFromList = async (email) => {
  const response = await brevoFetch(`/contacts/lists/${process.env.BREVO_LIST_ID}/contacts/remove`, { emails: [email] });
  if (response.ok) return;
  const text = await response.text();
  // Already off the list, or never made it into Brevo: nothing to undo.
  if (response.status === 400 || response.status === 404) {
    logger.info(`Brevo: ${email} was not on list ${process.env.BREVO_LIST_ID} (${text})`);
    return;
  }
  throw new Error(`Brevo list removal failed (${response.status}): ${text}`);
};

// Only applicants who ticked "I'm happy to receive updates and news" go on
// the list. Unticking it, or changing the email, takes the old one off.
const syncContact = async (submission) => {
  if (!isConfigured()) return { skipped: 'not_configured' };

  const wanted = submission.marketing_consent && submission.email ? submission.email : null;
  const current = submission.brevo_contact_email;

  if (current && current !== wanted) {
    await removeFromList(current);
    await submission.update({ brevo_contact_email: null }, { silent: true });
  }
  if (wanted) {
    await addToList(submission);
    await submission.update({ brevo_contact_email: wanted }, { silent: true });
  }
  return { listed: Boolean(wanted) };
};

module.exports = { syncContact, isConfigured, buildAttributes };
