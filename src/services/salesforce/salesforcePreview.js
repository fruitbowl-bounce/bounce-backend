const LoanOfferTemplate = require('../../models/LoanOfferTemplate');
const logger = require('../../utils/logger');
const { fetchCompanyDetails } = require('../companiesHouse');
const {
  OFFERS_SHOWN_STAGE,
  applicantStatusFor,
  documentPublicUrl,
  mapSubmissionToLead,
  mapSubmissionToOpportunity,
  mapSubmissionToContact,
  mapSubmissionToAccount,
  mapCompanyDetailsToAccount,
} = require('./fieldMapper');

// Every field the sync writes for an application, built with the same
// mappers, for the admin panel (Joshua 13/10: "all the info we put into
// Salesforce"). Before the offers page that's the Lead; after, the
// Opportunity, Contact and Account. Companies House details are fetched
// live, as the sync does.
const LINK_FIELDS = {
  Bank_Statement_Links__c: ['bank_statement', 'Bank Statement'],
  Filed_Accounts_Links__c: ['filed_accounts', 'Filed Accounts'],
};

// The Rich Text link fields as plain { label, url } items, not HTML.
const documentLinks = (documents, docType, label) => (documents || [])
  .filter((doc) => doc.doc_type === docType)
  .map((doc, i) => ({ label: `${label} ${i + 1}`, url: documentPublicUrl(doc.public_token) }));

const buildSalesforcePreview = async (submission) => {
  const offerTemplates = (await LoanOfferTemplate.findAll({
    where: { active: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  })).map((t) => t.asJson());

  if (submission.funnel_stage < OFFERS_SHOWN_STAGE) {
    return { objects: [{ name: 'Lead', fields: mapSubmissionToLead(submission, offerTemplates) }] };
  }

  const opportunity = {
    ...mapSubmissionToOpportunity(submission, offerTemplates),
    Applicant_Status__c: applicantStatusFor(submission),
  };
  for (const [field, [docType, label]] of Object.entries(LINK_FIELDS)) {
    const links = documentLinks(submission.documents, docType, label);
    opportunity[field] = links.length ? links : null;
  }

  let companyDetails = {};
  let companyDetailsError = null;
  if (submission.company_number) {
    try {
      const details = await fetchCompanyDetails(submission.company_number);
      companyDetails = details ? mapCompanyDetailsToAccount(details) : {};
    } catch (error) {
      logger.warn(`Companies House lookup failed for ${submission.application_ref}: ${error.message}`);
      companyDetailsError = 'Companies House details could not be loaded right now.';
    }
  }

  return {
    objects: [
      { name: 'Opportunity', fields: opportunity },
      { name: 'Contact', fields: { ...mapSubmissionToContact(submission), Birthdate: submission.date_of_birth || null } },
      { name: 'Account', fields: { ...mapSubmissionToAccount(submission), ...companyDetails } },
    ],
    companyDetailsError,
  };
};

module.exports = { buildSalesforcePreview };
