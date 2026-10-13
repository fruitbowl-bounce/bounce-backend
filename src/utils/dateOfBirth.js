// Date of birth as YYYY-MM-DD: a real calendar date, aged 18 to 100 today.
// Same rule as bounce-funding/src/validation.ts.
const MIN_AGE = 18;
const MAX_AGE = 100;

const ageOn = (birth, today) => {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassed = today.getUTCMonth() > birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  return birthdayPassed ? age : age - 1;
};

const isValidDateOfBirth = (value, today = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  // Rejects dates like 31/02, which Date rolls over into March.
  if (birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return false;
  const age = ageOn(birth, today);
  return age >= MIN_AGE && age <= MAX_AGE;
};

module.exports = { isValidDateOfBirth };
