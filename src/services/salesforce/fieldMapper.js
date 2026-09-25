// Fixed on every submission — this integration is UK-only for Bounce
// Funding today; a real per-partner/per-market value can replace these
// later without any change on the Salesforce side.
const PARTNER_ID = 'bounce-funding';
const PARTNER_COUNTRY = 'UK';

const documentPublicUrl = (token) => {
  const protocol = process.env.APP_PROTOCOL || 'http';
  const domain = process.env.APP_DOMAIN || 'localhost:3000';
  return `${protocol}://${domain}/api/v2/nebryx/public/documents/${token}`;
};

// Offer amounts are stored display-formatted ("£1,769") for the admin panel,
// but both fields are Currency on the Salesforce side, which only accepts a
// plain number — strip the formatting on the way out.
const toCurrencyNumber = (value) => {
  const digits = String(value ?? '').replace(/[^0-9.-]/g, '');
  if (!/\d/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// One permanent link per uploaded file of that type, one per line — a
// Loan_Application__c can have several bank statements / accounts files.
// Both link fields are Rich Text Area on the Salesforce side, so each link
// goes over as an HTML anchor (a bare URL saves but isn't clickable there).
const documentLinksBlock = (documents, docType, label) =>
  (documents || [])
    .filter((doc) => doc.doc_type === docType)
    .map((doc, i) => `<a href="${escapeHtml(documentPublicUrl(doc.public_token))}" target="_blank">${label} ${i + 1}</a>`)
    .join('<br>') || null;

// Maps a form_submissions row 1:1 onto the custom fields created by hand on
// the Loan_Application__c object in Salesforce Setup (see the plan's field
// list). Application_Ref__c is the external-ID field used for upsert, so it
// isn't included here — the caller puts it in the upsert URL, not the body.
// `submission.documents` (if loaded) feeds the two link fields below.
const mapSubmissionToSalesforce = (submission) => ({
  Partner_Id__c: PARTNER_ID,
  Partner_Country__c: PARTNER_COUNTRY,
  Bank_Statement_Links__c: documentLinksBlock(submission.documents, 'bank_statement', 'Bank Statement'),
  Filed_Accounts_Links__c: documentLinksBlock(submission.documents, 'filed_accounts', 'Filed Accounts'),
  Loan_Amount__c: submission.loan_amount,
  Funding_Purpose__c: submission.funding_purpose,
  Applicant_Email__c: submission.email,
  // Salesforce Checkbox fields reject null outright (INVALID_TYPE_ON_FIELD) —
  // unlike text/number fields they're strictly true/false, never "unknown",
  // so any not-yet-answered boolean must still go over as false.
  Marketing_Consent__c: !!submission.marketing_consent,
  Trading_Time__c: submission.trading_time,
  Turnover_Range__c: submission.turnover_range,
  Director_Name__c: submission.director_name,
  Home_Address__c: submission.home_address,
  Phone__c: submission.phone,
  Owns_Property__c: !!submission.owns_property,
  Director_Confirmed__c: !!submission.director_confirmed,
  Company_Name__c: submission.company_name,
  Company_Number__c: submission.company_number,
  Company_Address__c: submission.company_address,
  Offer_Name__c: submission.offer_name,
  Offer_APR__c: submission.offer_apr,
  Offer_Term__c: submission.offer_term,
  Offer_Monthly_Repayment__c: toCurrencyNumber(submission.offer_monthly_repayment),
  Offer_Max_Amount__c: toCurrencyNumber(submission.offer_max_amount),
  Offer_Factor_Rate__c: submission.offer_factor_rate,
  Offer_Tag__c: submission.offer_tag,
});

module.exports = { mapSubmissionToSalesforce };
