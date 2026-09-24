// One entry per email in bounce-phase-1-customer-emails-for-matts-sign-off.md.
// `defaultHours` is how long to wait — since the applicant reached
// `stageMatch`, or since `requiresPriorKey` was sent, whichever applies —
// before this one goes out. Every wait is overridable via its env var
// without touching code, see .env.example.
const RULES = [
  {
    key: 'incomplete_1',
    label: 'Application incomplete — reminder 1',
    eventKey: 'application.incomplete.reminder1',
    hoursEnvVar: 'REMINDER_INCOMPLETE_1_HOURS',
    defaultHours: 24,
    requiresPriorKey: null,
    stageMatch: (stage) => stage >= 1 && stage <= 3,
  },
  {
    key: 'incomplete_2',
    label: 'Application incomplete — reminder 2',
    eventKey: 'application.incomplete.reminder2',
    hoursEnvVar: 'REMINDER_INCOMPLETE_2_HOURS',
    defaultHours: 48,
    requiresPriorKey: 'incomplete_1',
    stageMatch: (stage) => stage >= 1 && stage <= 3,
  },
  {
    key: 'offers_1',
    label: 'Offers available — reminder 1',
    eventKey: 'offers.available.reminder1',
    hoursEnvVar: 'REMINDER_OFFERS_1_HOURS',
    defaultHours: 24,
    requiresPriorKey: null,
    stageMatch: (stage) => stage === 4,
  },
  {
    key: 'offers_2',
    label: 'Offers available — reminder 2',
    eventKey: 'offers.available.reminder2',
    hoursEnvVar: 'REMINDER_OFFERS_2_HOURS',
    defaultHours: 48, // + offers_1's 24h = day 3
    requiresPriorKey: 'offers_1',
    stageMatch: (stage) => stage === 4,
  },
  {
    key: 'offers_3',
    label: 'Offers available — reminder 3',
    eventKey: 'offers.available.reminder3',
    hoursEnvVar: 'REMINDER_OFFERS_3_HOURS',
    defaultHours: 96, // + the 72h above = day 7
    requiresPriorKey: 'offers_2',
    stageMatch: (stage) => stage === 4,
  },
  {
    key: 'offer_selected',
    label: 'Offer selected confirmation',
    eventKey: 'offer.selected',
    hoursEnvVar: 'REMINDER_OFFER_SELECTED_HOURS',
    defaultHours: 0, // "promptly" — fires on the next scheduler tick
    requiresPriorKey: null,
    stageMatch: (stage) => stage >= 5,
  },
  {
    key: 'documents_unfinished',
    label: 'Documents unfinished reminder',
    eventKey: 'documents.unfinished',
    hoursEnvVar: 'REMINDER_DOCUMENTS_UNFINISHED_HOURS',
    defaultHours: 24, // doc left this one as "timing to agree" — placeholder default
    requiresPriorKey: null,
    stageMatch: (stage) => stage === 5,
  },
  {
    key: 'documents_received',
    label: 'Documents received confirmation',
    eventKey: 'documents.received',
    hoursEnvVar: 'REMINDER_DOCUMENTS_RECEIVED_HOURS',
    defaultHours: 0, // "after successful submission" — fires on the next tick
    requiresPriorKey: null,
    stageMatch: (stage) => stage === 6,
  },
];

module.exports = RULES;
