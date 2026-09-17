// Maps a form_submissions row 1:1 onto the custom fields created by hand on
// the Loan_Application__c object in Salesforce Setup (see the plan's field
// list). Application_Ref__c is the external-ID field used for upsert, so it
// isn't included here — the caller puts it in the upsert URL, not the body.
const mapSubmissionToSalesforce = (submission) => ({
  Loan_Amount__c: submission.loan_amount,
  Funding_Purpose__c: submission.funding_purpose,
  Applicant_Email__c: submission.email,
  Marketing_Consent__c: submission.marketing_consent,
  Trading_Time__c: submission.trading_time,
  Turnover_Range__c: submission.turnover_range,
  Director_Name__c: submission.director_name,
  Home_Address__c: submission.home_address,
  Phone__c: submission.phone,
  Owns_Property__c: submission.owns_property,
  Director_Confirmed__c: submission.director_confirmed,
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
