const { monthlyRepaymentFor } = require('../../utils/offerMath');
const { splitUkAddress } = require('../../utils/ukAddress');
// Companies House's own SIC 2007 descriptions (api-enumerations constants.yml).
const SIC_DESCRIPTIONS = require('../../data/sicCodes.json');

// Fixed on every submission — this integration is UK-only for Bounce
// Funding today; a real per-partner/per-market value can replace these
// later without any change on the Salesforce side.
const PARTNER_ID = 'bounce-funding';
const PARTNER_COUNTRY = 'UK';

// Stage 4 is the offers page — reaching it means the applicant has been
// shown every active offer, whether or not they go on to pick one. It's
// also the point the Lead is converted into an Opportunity.
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

// One permanent link per uploaded file of that type, one per line — an
// application can have several bank statements / accounts files.
// Both link fields are Rich Text Area on the Salesforce side, so each link
// goes over as an HTML anchor (a bare URL saves but isn't clickable there).
const documentLinksBlock = (documents, docType, label) =>
  (documents || [])
    .filter((doc) => doc.doc_type === docType)
    .map((doc, i) => `<a href="${escapeHtml(documentPublicUrl(doc.public_token))}" target="_blank">${label} ${i + 1}</a>`)
    .join('<br>') || null;

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

// An offer is priced either as an APR or as a factor rate, never both —
// the client wants Offer APR kept for real percentage rates only.
const offerRateFields = (submission) => {
  const factorRate = submission.offer_factor_rate ? Number(submission.offer_factor_rate) : null;
  return {
    Offer_APR__c: factorRate ? null : submission.offer_apr,
    // Text on both the Lead and the Opportunity in the client's org.
    Offer_Factor_Rate__c: factorRate ? String(factorRate) : null,
  };
};

// The Lead exists from the very first save (Stage 1, email entered) and is
// kept current on every later save. Salesforce requires LastName and
// Company on every Lead, but the applicant's name only arrives at Stage 3 —
// until then the email stands in as the name (agreed with the client).
// Application_Ref__c is the Lead's external-ID field, put in the upsert URL
// by the caller. `offerTemplates` are the active offers (public shape) the
// applicant sees at Stage 4.
const mapSubmissionToLead = (submission, offerTemplates) => {
  const { firstName, lastName } = splitName(submission.director_name);
  const offersShown = submission.funnel_stage >= OFFERS_SHOWN_STAGE;
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
    ...offerRateFields(submission),
    Offer_Term__c: submission.offer_term,
    Offer_Monthly_Repayment__c: toCurrencyNumber(submission.offer_monthly_repayment),
    // No Offer_Tag__c here — the client's Lead doesn't have it, and an
    // unknown field fails the whole upsert.
  };
};

// Everything deal-specific, written to the Opportunity once the Lead has
// converted. Amount ("Lender Offer Amount") and Stage are the brokers' to
// set, so they're never sent. Application_Ref__c carries across from the
// Lead at conversion via the client's Lead field mapping.
const mapSubmissionToOpportunity = (submission, offerTemplates) => ({
  Amount_Requested__c: submission.loan_amount != null ? Number(submission.loan_amount) : null,
  Funding_Purpose__c: submission.funding_purpose,
  Turnover_Range__c: submission.turnover_range,
  Owns_Property__c: !!submission.owns_property,
  Director_Confirmed__c: !!submission.director_confirmed,
  Partner_ID_Source__c: PARTNER_ID,
  Partner_Country__c: PARTNER_COUNTRY,
  Offers_Shown__c: offersShownBlock(offerTemplates, submission.loan_amount),
  Offer_Selected__c: !!submission.offer_id,
  Offer_Name__c: submission.offer_name,
  ...offerRateFields(submission),
  Requested_Term__c: submission.offer_term,
  Estimated_Monthly_Repayment__c: toCurrencyNumber(submission.offer_monthly_repayment),
  // No Offer_Max_Amount__c: the client never created it on the Opportunity
  // (unused, the offer templates have no max), and an unknown field fails
  // the whole update.
  Offer_Tag__c: submission.offer_tag,
  Bank_Statement_Links__c: documentLinksBlock(submission.documents, 'bank_statement', 'Bank Statement'),
  Filed_Accounts_Links__c: documentLinksBlock(submission.documents, 'filed_accounts', 'Filed Accounts'),
});

// The applicant as a person. By conversion (Stage 4) the Stage 3 name is
// always present; the email fallback only guards Salesforce's required
// LastName.
const mapSubmissionToContact = (submission) => {
  const { firstName, lastName } = splitName(submission.director_name);
  const address = splitUkAddress(submission.home_address);
  return {
    FirstName: firstName,
    LastName: (lastName || submission.email).slice(0, 80),
    Email: submission.email,
    Phone: submission.phone || null,
    MailingStreet: address.street,
    MailingCity: address.city,
    MailingPostalCode: address.postalCode,
    MailingCountry: address.country,
    Marketing_Consent__c: !!submission.marketing_consent,
  };
};

// The business. For a returning applicant this is their existing Account,
// refreshed with the latest details from the form.
const mapSubmissionToAccount = (submission) => {
  const address = splitUkAddress(submission.company_address);
  return {
    Name: (submission.company_name || 'Not provided yet').slice(0, 255),
    Company_Number__c: submission.company_number || null,
    BillingStreet: address.street,
    BillingCity: address.city,
    BillingPostalCode: address.postalCode,
    BillingCountry: address.country,
  };
};

// Companies House status labels, as their own site shows them.
const COMPANY_STATUS = {
  active: 'Active',
  dissolved: 'Dissolved',
  liquidation: 'Liquidation',
  receivership: 'Receiver Action',
  'converted-closed': 'Converted / Closed',
  'voluntary-arrangement': 'Voluntary Arrangement',
  'insolvency-proceedings': 'Insolvency Proceedings',
  administration: 'In Administration',
  open: 'Open',
  closed: 'Closed',
  registered: 'Registered',
  removed: 'Removed',
};

const ukDate = (isoDate) => (isoDate ? isoDate.split('-').reverse().join('/') : null);

// Long Text Area limit on the client's fields.
const longText = (lines, max = 2000) => (lines.length ? lines.join('\n').slice(0, max) : null);

// "ownership-of-shares-25-to-50-percent-as-trust" -> "25-50% shares (via trust)"
const natureOfControl = (nature) => {
  const via = nature.match(/-as-(trust|firm)/)?.[1];
  const range = nature.match(/(\d+)-to-(\d+)-percent/);
  const share = range ? `${range[1]}-${range[2]}%` : /more-than-25-percent/.test(nature) ? 'over 25%' : null;
  let label;
  if (nature.startsWith('ownership-of-shares')) label = `${share} shares`;
  else if (nature.startsWith('voting-rights')) label = `${share} voting rights`;
  else if (nature.startsWith('right-to-appoint-and-remove')) label = 'right to appoint/remove directors';
  else if (nature.startsWith('significant-influence-or-control')) label = 'significant influence or control';
  else label = nature.replace(/-/g, ' ');
  return via ? `${label} (via ${via})` : label;
};

// Registered details from Companies House (see services/companiesHouse.js).
// Kept separate from mapSubmissionToAccount so a failed lookup leaves the
// values already in Salesforce alone instead of blanking them.
const mapCompanyDetailsToAccount = ({ profile = {}, charges = [], pscs = [] }) => {
  const accounts = profile.accounts || {};
  // Only charges still in force: satisfied ones are old, repaid lenders.
  const outstanding = charges.filter((c) => c.status === 'outstanding' || c.status === 'part-satisfied');
  return {
    Company_Status__c: COMPANY_STATUS[profile.company_status] || profile.company_status || null,
    Incorporation_Date__c: profile.date_of_creation || null,
    SIC_Codes__c: longText((profile.sic_codes || []).map((code) => `${code} ${SIC_DESCRIPTIONS[code] || ''}`.trim()), 1000),
    Confirmation_Statement_Overdue__c: !!profile.confirmation_statement?.overdue,
    Accounts_Overdue__c: !!(accounts.overdue || accounts.next_accounts?.overdue),
    Last_Accounts_Made_Up_To__c: accounts.last_accounts?.made_up_to || null,
    Next_Accounts_Due__c: accounts.next_due || accounts.next_accounts?.due_on || null,
    Insolvency_History__c: !!profile.has_insolvency_history,
    Outstanding_Charges__c: outstanding.length,
    // "Lloyds Bank PLC, Debenture, created 26/11/2006"
    Charge_Holders__c: longText(outstanding.map((c) => [
      (c.persons_entitled || []).map((p) => p.name).join(' & ') || 'Unknown lender',
      c.classification?.description,
      c.created_on && `created ${ukDate(c.created_on)}`,
      c.status === 'part-satisfied' && 'part satisfied',
    ].filter(Boolean).join(', '))),
    // "Mr James Hoe, 25-50% shares, 25-50% voting rights" (current PSCs only)
    PSCs__c: longText(pscs
      .filter((p) => !p.ceased_on && !p.ceased)
      .map((p) => [p.name, ...(p.natures_of_control || []).map(natureOfControl)].join(', '))),
  };
};

module.exports = {
  OFFERS_SHOWN_STAGE,
  mapSubmissionToLead,
  mapSubmissionToOpportunity,
  mapSubmissionToContact,
  mapSubmissionToAccount,
  mapCompanyDetailsToAccount,
};
