// Lists every field the Salesforce sync writes that the connected org is
// missing, or that the integration user can't edit (field-level security).
// Run it against a new or changed org before syncing, so all the gaps show
// up at once instead of one failed sync at a time:
//
//   docker compose exec backend node scripts/checkSalesforceFields.js
//
// Read-only: it only calls describe on each object.
const { getToken } = require('../src/services/salesforce/salesforceAuth');
const {
  mapSubmissionToLead,
  mapSubmissionToOpportunity,
  mapSubmissionToContact,
  mapSubmissionToAccount,
  mapCompanyDetailsToAccount,
} = require('../src/services/salesforce/fieldMapper');

// The mappers' keys are exactly the fields each write sends, so a blank
// submission is enough to list them. Application_Ref__c is also used as the
// Lead's upsert key and to look up conversions.
const blank = { funnel_stage: 6, email: '', documents: [] };
const FIELDS = {
  Lead: [...Object.keys(mapSubmissionToLead(blank, [])), 'Application_Ref__c'],
  Opportunity: Object.keys(mapSubmissionToOpportunity(blank, [])),
  Contact: Object.keys(mapSubmissionToContact(blank)),
  Account: [...Object.keys(mapSubmissionToAccount(blank)), ...Object.keys(mapCompanyDetailsToAccount({}))],
};

(async () => {
  const token = await getToken();
  const version = process.env.SALESFORCE_API_VERSION || 'v60.0';
  console.log(`Org: ${token.instanceUrl}\n`);

  let problems = 0;
  for (const [object, names] of Object.entries(FIELDS)) {
    const response = await fetch(`${token.instanceUrl}/services/data/${version}/sobjects/${object}/describe`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!response.ok) throw new Error(`${object} describe failed (${response.status}): ${await response.text()}`);
    const fields = Object.fromEntries((await response.json()).fields.map((f) => [f.name, f]));

    for (const name of names) {
      const field = fields[name];
      let issue = null;
      if (!field) issue = 'MISSING (or hidden from the integration user)';
      else if (name !== 'Application_Ref__c' && !field.updateable) issue = 'NOT EDITABLE by the integration user';
      if (issue) {
        problems++;
        console.log(`  ${object}.${name}: ${issue}`);
      }
    }
    console.log(`${object}: ${names.length} fields checked`);
  }

  console.log(problems ? `\n${problems} problem(s) found` : '\nAll fields present and editable');
  process.exit(problems ? 1 : 0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
