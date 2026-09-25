const { getToken } = require('./salesforceAuth');
const { mapSubmissionToSalesforce, mapSubmissionToLead } = require('./fieldMapper');

// Both objects carry an Application_Ref__c field marked External ID +
// Unique, which is also how the client's side links a Lead to its
// Loan_Application__c.
const EXTERNAL_ID_FIELD = 'Application_Ref__c';

// PATCH .../sobjects/{object}/Application_Ref__c/{ref} upserts: creates the
// record if no match, updates it if one exists. Idempotent by design, so a
// retried job never creates a duplicate. `knownId` is returned when
// Salesforce answers 204 (updated, no body) since that carries no id.
const upsert = async (object, applicationRef, fields, knownId) => {
  const apiVersion = process.env.SALESFORCE_API_VERSION || 'v60.0';

  const recordUrl = (token) =>
    `${token.instanceUrl}/services/data/${apiVersion}/sobjects/${object}/${EXTERNAL_ID_FIELD}/${encodeURIComponent(applicationRef)}`;

  const attempt = async (token) => {
    return fetch(recordUrl(token), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
        // Duplicate rules set to "Allow" with an alert still reject API
        // saves unless asked to allow them — e.g. the standard Lead rule
        // matching a returning applicant. A rule set to "Block" still blocks.
        'Sforce-Duplicate-Rule-Header': 'allowSave=true',
      },
      body: JSON.stringify(fields),
    });
  };

  let token = await getToken();
  let response = await attempt(token);

  if (response.status === 401) {
    token = await getToken(true);
    response = await attempt(token);
  }

  // Two sync jobs for the same application can both try to *create* the
  // record at once; the loser gets DUPLICATE_VALUE on the external id. By
  // now the record exists, so one more upsert simply updates it.
  if (response.status === 400) {
    const text = await response.clone().text();
    if (text.includes('DUPLICATE_VALUE') && text.includes(EXTERNAL_ID_FIELD)) {
      response = await attempt(token);
    }
  }

  // 201 Created (new record) and 204 No Content (existing record updated,
  // no body) are the documented outcomes, but Salesforce has also been
  // observed returning 200 with a { id, success, errors } body for some
  // updates — treat any 2xx with a JSON body the same way as 201.
  if (response.status === 201 || response.status === 200) {
    const body = await response.json();
    if (body.success === false) {
      throw new Error(`Salesforce ${object} upsert failed: ${JSON.stringify(body.errors)}`);
    }
    return body.id || knownId || null;
  }
  if (response.status === 204) {
    if (knownId) return knownId;
    // Updated an existing record we have no id for locally — look it up,
    // since the Lead id feeds the Loan_Application__c's Lead__c lookup.
    const lookup = await fetch(`${recordUrl(token)}?fields=Id`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    return lookup.ok ? (await lookup.json()).Id || null : null;
  }

  const text = await response.text();
  throw new Error(`Salesforce ${object} upsert failed (${response.status}): ${text}`);
};

const upsertLead = (submission, offerTemplates) =>
  upsert('Lead', submission.application_ref, mapSubmissionToLead(submission, offerTemplates), submission.salesforce_lead_id);

const upsertSubmission = (submission) =>
  upsert('Loan_Application__c', submission.application_ref, mapSubmissionToSalesforce(submission), submission.salesforce_id);

module.exports = { upsertLead, upsertSubmission };
