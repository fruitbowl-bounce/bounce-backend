const { getToken } = require('./salesforceAuth');

// The Lead carries an Application_Ref__c field marked External ID + Unique;
// the Opportunity it converts into carries the same value.
const EXTERNAL_ID_FIELD = 'Application_Ref__c';

// The Lead Status value marked "Converted" in the client's org.
const CONVERTED_STATUS = 'Qualified';

const apiVersion = () => process.env.SALESFORCE_API_VERSION || 'v60.0';

// Duplicate rules set to "Allow" with an alert still reject API saves unless
// asked to allow them — e.g. the standard Lead rule matching a returning
// applicant. A rule set to "Block" still blocks.
const DUPLICATE_HEADER = { 'Sforce-Duplicate-Rule-Header': 'allowSave=true' };

// REST call against /services/data/vXX.X/<path>, retried once with a fresh
// token on 401 (session expired or revoked).
const restFetch = async (path, options = {}) => {
  const attempt = (token) => fetch(`${token.instanceUrl}/services/data/${apiVersion()}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token.accessToken}`, ...options.headers },
  });

  let response = await attempt(await getToken());
  if (response.status === 401) response = await attempt(await getToken(true));
  return response;
};

const failure = async (what, response) =>
  new Error(`Salesforce ${what} failed (${response.status}): ${await response.text()}`);

// SOQL string literal: backslashes and single quotes must be escaped.
const soqlString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const query = async (soql) => {
  const response = await restFetch(`query?q=${encodeURIComponent(soql)}`);
  if (!response.ok) throw await failure('query', response);
  return (await response.json()).records;
};

// PATCH .../sobjects/{object}/Application_Ref__c/{ref} upserts: creates the
// record if no match, updates it if one exists. Idempotent by design, so a
// retried job never creates a duplicate. `knownId` is returned when
// Salesforce answers 204 (updated, no body) since that carries no id.
const upsertByRef = async (object, applicationRef, fields, knownId) => {
  const path = `sobjects/${object}/${EXTERNAL_ID_FIELD}/${encodeURIComponent(applicationRef)}`;
  const send = () => restFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...DUPLICATE_HEADER },
    body: JSON.stringify(fields),
  });

  let response = await send();

  // Two sync jobs for the same application can both try to *create* the
  // record at once; the loser gets DUPLICATE_VALUE on the external id. By
  // now the record exists, so one more upsert simply updates it.
  if (response.status === 400) {
    const text = await response.clone().text();
    if (text.includes('DUPLICATE_VALUE') && text.includes(EXTERNAL_ID_FIELD)) {
      response = await send();
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
    const lookup = await restFetch(`${path}?fields=Id`);
    return lookup.ok ? (await lookup.json()).Id || null : null;
  }

  throw await failure(`${object} upsert`, response);
};

const updateById = async (object, id, fields) => {
  const response = await restFetch(`sobjects/${object}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...DUPLICATE_HEADER },
    body: JSON.stringify(fields),
  });
  if (!response.ok) throw await failure(`${object} ${id} update`, response);
};

// Whether this application's Lead has been converted, and into what. A
// converted Lead can no longer be upserted (Salesforce no longer matches it
// by external id, and a new Lead with the same ref is a DUPLICATE_VALUE),
// so this is checked before every write until the ids are stored locally.
// It also picks up a Lead a broker converted by hand in Salesforce.
const findConversion = async (applicationRef) => {
  const [lead] = await query(
    `SELECT Id, IsConverted, ConvertedOpportunityId, ConvertedContactId, ConvertedAccountId
     FROM Lead WHERE ${EXTERNAL_ID_FIELD} = ${soqlString(applicationRef)} LIMIT 1`
  );
  if (!lead) return null;
  return {
    leadId: lead.Id,
    isConverted: lead.IsConverted,
    opportunityId: lead.ConvertedOpportunityId,
    contactId: lead.ConvertedContactId,
    accountId: lead.ConvertedAccountId,
  };
};

// A returning applicant is the same email at the same business (agreed with
// the client): matched on company number where we have one, falling back to
// the company name for Accounts with no number (e.g. created by hand). The
// same email at a different business is treated as a new person.
const findExistingContact = async ({ email, companyNumber, companyName }) => {
  if (!email || (!companyNumber && !companyName)) return null;
  const byName = companyName ? `Account.Name = ${soqlString(companyName)}` : null;
  const companyMatch = companyNumber
    ? `(Account.Company_Number__c = ${soqlString(companyNumber)}${byName ? ` OR (Account.Company_Number__c = null AND ${byName})` : ''})`
    : byName;
  const [contact] = await query(
    `SELECT Id, AccountId FROM Contact
     WHERE Email = ${soqlString(email)} AND AccountId != null AND ${companyMatch}
     ORDER BY CreatedDate DESC LIMIT 1`
  );
  return contact ? { contactId: contact.Id, accountId: contact.AccountId } : null;
};

const xmlEscape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const xmlTag = (xml, name) => {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`));
  return match ? match[1] : null;
};

// convertLead() only exists on the SOAP API (the client's Professional
// Edition org has no Apex to expose it to Flow or REST). The REST OAuth
// token carries the "api" scope, so it works directly as the SOAP session
// id. Passing an existing accountId + contactId links the new Opportunity to
// a returning applicant instead of creating duplicates.
const convertLead = async ({ leadId, accountId, contactId, opportunityName }) => {
  const optional = [
    accountId && `<urn:accountId>${xmlEscape(accountId)}</urn:accountId>`,
    contactId && `<urn:contactId>${xmlEscape(contactId)}</urn:contactId>`,
    opportunityName && `<urn:opportunityName>${xmlEscape(opportunityName)}</urn:opportunityName>`,
  ].filter(Boolean).join('');

  const envelope = (sessionId) => `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:enterprise.soap.sforce.com">
<soapenv:Header>
<urn:SessionHeader><urn:sessionId>${xmlEscape(sessionId)}</urn:sessionId></urn:SessionHeader>
<urn:DuplicateRuleHeader><urn:allowSave>true</urn:allowSave></urn:DuplicateRuleHeader>
</soapenv:Header>
<soapenv:Body><urn:convertLead><urn:leadConverts>
${optional}<urn:convertedStatus>${CONVERTED_STATUS}</urn:convertedStatus>
<urn:doNotCreateOpportunity>false</urn:doNotCreateOpportunity>
<urn:leadId>${xmlEscape(leadId)}</urn:leadId>
<urn:sendNotificationEmail>false</urn:sendNotificationEmail>
</urn:leadConverts></urn:convertLead></soapenv:Body>
</soapenv:Envelope>`;

  const attempt = (token) => fetch(`${token.instanceUrl}/services/Soap/c/${apiVersion().replace(/^v/, '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '""' },
    body: envelope(token.accessToken),
  });

  let xml = await (await attempt(await getToken())).text();
  if (xml.includes('INVALID_SESSION_ID')) xml = await (await attempt(await getToken(true))).text();

  const fault = xmlTag(xml, 'faultstring');
  if (fault) throw new Error(`Salesforce convertLead failed: ${fault}`);
  if (xmlTag(xml, 'success') !== 'true') {
    throw new Error(`Salesforce convertLead failed: ${xmlTag(xml, 'statusCode')} - ${xmlTag(xml, 'message')}`);
  }
  return {
    opportunityId: xmlTag(xml, 'opportunityId'),
    contactId: xmlTag(xml, 'contactId'),
    accountId: xmlTag(xml, 'accountId'),
  };
};

module.exports = {
  upsertByRef,
  updateById,
  findConversion,
  findExistingContact,
  convertLead,
};
