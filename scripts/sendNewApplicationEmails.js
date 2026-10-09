// Sends the "New application" team email for applications that reached the
// offers page before it existed (or while it was switched off). Skips any
// that already had it. Lists what it would send unless --send is given:
//
//   docker compose exec backend node scripts/sendNewApplicationEmails.js BF-AAAA1111 BF-BBBB2222
//   docker compose exec backend node scripts/sendNewApplicationEmails.js BF-AAAA1111 BF-BBBB2222 --send
const { initializeModels } = require('../src/models');
const FormSubmission = require('../src/models/FormSubmission');
const { closeQueue } = require('../src/services/email');
const { notifyNewApplication } = require('../src/services/notifications/teamNotification');

const args = process.argv.slice(2);
const send = args.includes('--send');
const refs = args.filter((a) => a !== '--send');

(async () => {
  if (!refs.length) throw new Error('Give one or more application refs');
  if (!process.env.TEAM_NOTIFICATION_EMAIL) throw new Error('TEAM_NOTIFICATION_EMAIL is not set');
  await initializeModels();

  for (const ref of refs) {
    const s = await FormSubmission.findOne({ where: { application_ref: ref } });
    if (!s) { console.log(`${ref}: not found`); continue; }
    const line = `${ref}: ${s.company_name || '-'} | ${s.email} | stage ${s.funnel_stage}`;
    if (!send) { console.log(`${line} (dry run)`); continue; }
    console.log(`${line} -> ${(await notifyNewApplication(s)) ? 'queued' : 'skipped (already sent or before offers)'}`);
  }
  if (send) await closeQueue();
  process.exit(0);
})().catch((err) => { console.error(err.message); process.exit(1); });
