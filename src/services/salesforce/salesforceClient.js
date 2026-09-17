const { getToken } = require('./salesforceAuth');
const { mapSubmissionToSalesforce } = require('./fieldMapper');

const OBJECT = 'Loan_Application__c';
const EXTERNAL_ID_FIELD = 'Application_Ref__c';

// PATCH .../sobjects/Loan_Application__c/Application_Ref__c/{ref} upserts:
// creates the record if no match, updates it if one exists. Idempotent by
// design, so a retried job never creates a duplicate.
const upsertSubmission = async (submission) => {
  const fields = mapSubmissionToSalesforce(submission);
  const apiVersion = process.env.SALESFORCE_API_VERSION || 'v60.0';

  const attempt = async (token) => {
    const url = `${token.instanceUrl}/services/data/${apiVersion}/sobjects/${OBJECT}/${EXTERNAL_ID_FIELD}/${encodeURIComponent(submission.application_ref)}`;
    return fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
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

  // 201 Created (new record, body has `id`) or 204 No Content (existing
  // record updated, no body) are the two success outcomes.
  if (response.status === 201) {
    const body = await response.json();
    return body.id;
  }
  if (response.status === 204) {
    return submission.salesforce_id || null;
  }

  const text = await response.text();
  throw new Error(`Salesforce upsert failed (${response.status}): ${text}`);
};

module.exports = { upsertSubmission };
