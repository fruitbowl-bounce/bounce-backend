const { monthlyRepaymentFor } = require('../../utils/offerMath');

// Fixed on every submission — this integration is UK-only for Bounce
// Funding today; a real per-partner/per-market value can replace these
// later without any change on the Salesforce side.
const PARTNER_ID = 'bounce-funding';
const PARTNER_COUNTRY = 'UK';

// Stage 4 is the offers page — reaching it means the applicant has been
// shown every active offer, whether or not they go on to pick one.
const OFFERS_SHOWN_STAGE = 4;

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
  // Lookup to the Lead — the sync always upserts the Lead first, so its id
  // is already stored by the time the Loan_Application__c is written.
  Lead__c: submission.salesforce_lead_id || null,
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

// Director names come from Companies House as "First Middle SURNAME".
const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  const lastName = parts.pop();
  return { firstName: parts.join(' ').slice(0, 40) || null, lastName };
};

// One line per offer the applicant was shown, with the same figures the
// Stage 4 cards display for their loan amount.
const offersShownBlock = (templates, loanAmount) =>
  (templates || [])
    .map((offer) => {
      const rate = offer.factorRate ? `factor rate ${offer.factorRate}` : offer.apr;
      const monthly = monthlyRepaymentFor(loanAmount, offer);
      return [offer.name, rate, offer.term, monthly && `est. ${monthly}/month`]
        .filter(Boolean)
        .join(', ');
    })
    .join('\n') || null;

// The Lead exists from the very first save (Stage 1, email entered) and is
// kept current on every later save. Salesforce requires LastName and
// Company on every Lead, but the applicant's name only arrives at Stage 3 —
// until then the email stands in as the name (agreed with the client).
// Application_Ref__c is the Lead's external-ID field, put in the upsert URL
// by the caller, same as for Loan_Application__c. `offerTemplates` are the
// active offers (public shape) the applicant sees at Stage 4.
const mapSubmissionToLead = (submission, offerTemplates) => {
  const { firstName, lastName } = splitName(submission.director_name);
  const offersShown = submission.funnel_stage >= OFFERS_SHOWN_STAGE;
  const factorRate = submission.offer_factor_rate ? Number(submission.offer_factor_rate) : null;
  return {
    FirstName: firstName,
    LastName: (lastName || submission.email).slice(0, 80),
    Email: submission.email,
    Phone: submission.phone || null,
    Company: submission.company_name || 'Not provided yet',
    Trading_Time__c: submission.trading_time,
    Turnover_Range__c: submission.turnover_range,
    // Checkbox — can't be null, so unanswered goes over as false.
    Owns_Property__c: !!submission.owns_property,
    // Raw partner id only — the client resolves it to their Partner
    // Account lookup (Partner__c) on their side.
    Partner_ID_Source__c: PARTNER_ID,
    Partner_Country__c: PARTNER_COUNTRY,
    Offers_Shown__c: offersShown ? offersShownBlock(offerTemplates, submission.loan_amount) : null,
    Offer_Selected__c: !!submission.offer_id,
    Offer_Name__c: submission.offer_name,
    // An offer is priced either as an APR or as a factor rate, never both —
    // the client wants Offer APR kept for real percentage rates only.
    // Offer_Factor_Rate__c is a Text field on their Lead (Number on the
    // Loan Application), hence the string.
    Offer_APR__c: factorRate ? null : submission.offer_apr,
    Offer_Factor_Rate__c: factorRate ? String(factorRate) : null,
    Offer_Term__c: submission.offer_term,
    Offer_Monthly_Repayment__c: toCurrencyNumber(submission.offer_monthly_repayment),
    // No Offer_Tag__c here — the client's Lead doesn't have it, and an
    // unknown field fails the whole upsert.
  };
};

module.exports = { mapSubmissionToSalesforce, mapSubmissionToLead };
