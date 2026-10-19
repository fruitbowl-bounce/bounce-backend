// The applicant's home address in four parts (BF-057, Joshua 16/10): house
// number or name, street, town and postcode, all required. Same rules as
// bounce-funding/src/validation.ts.
const { splitUkAddress } = require('./ukAddress');

const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const LIMITS = { house: 255, street: 255, town: 100 };

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// "wf148px" -> "WF14 8PX"
const normalisePostcode = (v) => {
  const compact = clean(v).replace(/\s/g, '').toUpperCase();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};

const isValidUkPostcode = (v) => POSTCODE.test(clean(v));

const cleanParts = (parts) => ({
  house: clean(parts?.house),
  street: clean(parts?.street),
  town: clean(parts?.town),
  postcode: normalisePostcode(parts?.postcode),
});

const isCompleteHomeAddress = (parts) => {
  if (!parts || typeof parts !== 'object') return false;
  const p = cleanParts(parts);
  return !!(p.house && p.street && p.town && isValidUkPostcode(p.postcode))
    && Object.entries(LIMITS).every(([key, max]) => p[key].length <= max);
};

// "17 Oakfield Drive" for a number, "Rose Cottage, Oakfield Drive" for a name.
const startsWithNumber = (house) => /^\d+[A-Z]?(-\d+[A-Z]?)?$/i.test(house);
const streetLine = (p, separator) => (startsWithNumber(p.house) ? `${p.house} ${p.street}` : `${p.house}${separator}${p.street}`);

// One line for the admin panel and emails: "17 Oakfield Drive, Mirfield, WF14 8PX".
const formatHomeAddress = (parts) => {
  const p = cleanParts(parts);
  return [streetLine(p, ', '), p.town, p.postcode].filter(Boolean).join(', ');
};

// Salesforce Mailing Street: a house name goes on its own line.
const mailingStreet = (parts) => streetLine(cleanParts(parts), '\n');

// Google Places (New) addressComponents -> parts. Anything Google leaves out
// stays blank for the applicant to fill in.
const partsFromPlace = (components = []) => {
  const get = (type) => components.find((c) => c.types?.includes(type))?.longText ?? '';
  const name = [get('subpremise'), get('premise')].filter(Boolean).join(', ');
  const number = get('street_number');
  return {
    house: name && number ? `${name}, ${number}` : name || number,
    street: get('route'),
    // UK towns come as postal_town; locality is the village or area.
    town: get('postal_town') || get('locality'),
    postcode: isValidUkPostcode(get('postal_code')) ? normalisePostcode(get('postal_code')) : '',
  };
};

// Parts for a saved application. Applications from before BF-057 only have
// the one-line address, so make a best guess for the applicant to check.
const homeAddressParts = (submission) => {
  if (submission.home_house || submission.home_street || submission.home_town || submission.home_postcode) {
    return {
      house: submission.home_house || '',
      street: submission.home_street || '',
      town: submission.home_town || '',
      postcode: submission.home_postcode || '',
    };
  }
  if (!submission.home_address) return { house: '', street: '', town: '', postcode: '' };
  const split = splitUkAddress(submission.home_address);
  const firstLine = (split.street || '').split('\n')[0];
  const numbered = firstLine.match(/^(\d+[A-Z]?)\s+(.+)$/i);
  return {
    house: numbered ? numbered[1] : '',
    street: numbered ? numbered[2] : firstLine,
    town: split.city || '',
    postcode: split.postalCode || '',
  };
};

module.exports = {
  normalisePostcode,
  isValidUkPostcode,
  cleanParts,
  isCompleteHomeAddress,
  formatHomeAddress,
  mailingStreet,
  partsFromPlace,
  homeAddressParts,
};
