// One entry per email in bounce-phase-1-customer-emails-for-matts-sign-off.md
// (email 7 has two entries: same email, sent twice).
// `defaultHours` is how long to wait before this one goes out, counted from:
//   from: 'activity' — the applicant's last save (i.e. since they left)
//   from: 'prior'    — when `requiresPriorKey` was sent
// `requiresPriorKey` also keeps a sequence in order. `quietHours` rules are
// reminders and only go out inside the UK send window (sendWindow.js);
// confirmations go out straight away at any hour. Every wait is overridable
// via its env var without touching code, see .env.example.
const RULES = [
  {
    key: 'incomplete_1',
    label: 'Application incomplete — reminder 1',
    eventKey: 'application.incomplete.reminder1',
    hoursEnvVar: 'REMINDER_INCOMPLETE_1_HOURS',
    defaultHours: 2,
    from: 'activity',
    requiresPriorKey: null,
    quietHours: true,
    stageMatch: (stage) => stage >= 1 && stage <= 3,
  },
  {
    key: 'incomplete_2',
    label: 'Application incomplete — reminder 2',
    eventKey: 'application.incomplete.reminder2',
    hoursEnvVar: 'REMINDER_INCOMPLETE_2_HOURS',
    defaultHours: 48, // "another 48 hours later"
    from: 'prior',
    requiresPriorKey: 'incomplete_1',
    quietHours: true,
    stageMatch: (stage) => stage >= 1 && stage <= 3,
  },
  {
    key: 'offers_1',
    label: 'Offers available — confirmation',
    eventKey: 'offers.available.reminder1',
    hoursEnvVar: 'REMINDER_OFFERS_1_HOURS',
    defaultHours: 0, // immediately on reaching the offers page, also sent on save
    from: 'activity',
    requiresPriorKey: null,
    quietHours: false,
    stageMatch: (stage) => stage === 4,
  },
  {
    key: 'offers_2',
    label: 'Offers available — reminder 2',
    eventKey: 'offers.available.reminder2',
    hoursEnvVar: 'REMINDER_OFFERS_2_HOURS',
    defaultHours: 48, // after leaving the offers page
    from: 'activity',
    requiresPriorKey: 'offers_1',
    quietHours: true,
    stageMatch: (stage) => stage === 4,
  },
  {
    key: 'offers_3',
    label: 'Offers available — reminder 3',
    eventKey: 'offers.available.reminder3',
    hoursEnvVar: 'REMINDER_OFFERS_3_HOURS',
    defaultHours: 168, // around day 7 after leaving the offers page
    from: 'activity',
    requiresPriorKey: 'offers_2',
    quietHours: true,
    stageMatch: (stage) => stage === 4,
  },
  {
    key: 'offer_selected',
    label: 'Offer selected confirmation',
    eventKey: 'offer.selected',
    hoursEnvVar: 'REMINDER_OFFER_SELECTED_HOURS',
    defaultHours: 0, // "promptly", also sent on save
    from: 'activity',
    requiresPriorKey: null,
    quietHours: false,
    stageMatch: (stage) => stage >= 5,
  },
  {
    key: 'documents_unfinished',
    label: 'Documents unfinished — reminder 1',
    eventKey: 'documents.unfinished',
    hoursEnvVar: 'REMINDER_DOCUMENTS_UNFINISHED_HOURS',
    defaultHours: 24, // 24 hours after selecting an option
    from: 'activity',
    requiresPriorKey: null,
    quietHours: true,
    stageMatch: (stage) => stage === 5,
  },
  {
    key: 'documents_unfinished_2',
    label: 'Documents unfinished — reminder 2',
    eventKey: 'documents.unfinished', // same email as reminder 1
    hoursEnvVar: 'REMINDER_DOCUMENTS_UNFINISHED_2_HOURS',
    defaultHours: 72, // around day 3
    from: 'activity',
    requiresPriorKey: 'documents_unfinished',
    quietHours: true,
    stageMatch: (stage) => stage === 5,
  },
  {
    key: 'documents_received',
    label: 'Documents received confirmation',
    eventKey: 'documents.received',
    hoursEnvVar: 'REMINDER_DOCUMENTS_RECEIVED_HOURS',
    defaultHours: 0, // "after successful submission", also sent on save
    from: 'activity',
    requiresPriorKey: null,
    quietHours: false,
    stageMatch: (stage) => stage === 6,
  },
];

module.exports = RULES;
