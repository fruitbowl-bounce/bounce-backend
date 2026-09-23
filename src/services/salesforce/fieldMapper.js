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

// One permanent link per uploaded file of that type, one per line — a
// Loan_Application__c can have several bank statements / accounts files.
const documentLinksBlock = (documents, docType) =>
  (documents || [])
    .filter((doc) => doc.doc_type === docType)
    .map((doc) => documentPublicUrl(doc.public_token))
    .join('\n') || null;

// Maps a form_submissions row 1:1 onto the custom fields created by hand on
// the Loan_Application__c object in Salesforce Setup (see the plan's field
// list). Application_Ref__c is the external-ID field used for upsert, so it
// isn't included here — the caller puts it in the upsert URL, not the body.
// `submission.documents` (if loaded) feeds the two link fields below.
const mapSubmissionToSalesforce = (submission) => ({
  Partner_Id__c: PARTNER_ID,
  Partner_Country__c: PARTNER_COUNTRY,
  Bank_Statement_Links__c: documentLinksBlock(submission.documents, 'bank_statement'),
  Filed_Accounts_Links__c: documentLinksBlock(submission.documents, 'filed_accounts'),
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
  Offer_Monthly_Repayment__c: submission.offer_monthly_repayment,
  Offer_Max_Amount__c: submission.offer_max_amount,
  Offer_Factor_Rate__c: submission.offer_factor_rate,
  Offer_Tag__c: submission.offer_tag,
});

module.exports = { mapSubmissionToSalesforce };
