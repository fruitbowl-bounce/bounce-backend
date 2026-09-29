// Addresses are stored as one comma-separated string, in one of two shapes:
//   home (address lookup):   "129 High St, Harborne, Birmingham B17 9NP, UK"
//   company (Companies House): "Fines House, London Road, Binfield, Berkshire, RG42 4AB"
// Salesforce's standard address fields want them split into parts. This is a
// best-effort split for UK addresses only (the funnel is UK-only today).

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const COUNTRY = /^(uk|u\.k\.|gb|great britain|united kingdom|england|scotland|wales|northern ireland)$/i;
// A trailing county/region ("Berkshire", "East Yorkshire", "Greater London")
// is dropped rather than sent as State: with State & Country picklists
// enabled, Salesforce rejects free-text states for GB, and a UK address is
// complete without one.
const COUNTY = /(shire$|^(east|west|north|south) (sussex|lothian|midlands|riding of yorkshire)$|^(greater (london|manchester)|merseyside|kent|essex|surrey|devon|cornwall|norfolk|suffolk|middlesex|tyne and wear|cumbria|dorset|somerset|rutland|county durham|northumberland|isle of wight|fife|highland|(co\.?|county) [a-z]+)$)/i;

const splitUkAddress = (address) => {
  const parts = String(address || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { street: null, city: null, postalCode: null, country: null };

  let postalCode = null;
  for (let i = parts.length - 1; i >= 0 && !postalCode; i--) {
    const match = parts[i].match(POSTCODE);
    if (match) {
      postalCode = match[1].toUpperCase().replace(/\s+/g, ' ').replace(/^(\S+?)(\d[A-Z]{2})$/, '$1 $2');
      parts[i] = parts[i].replace(match[0], '').trim();
      if (!parts[i]) parts.splice(i, 1);
    }
  }

  const remaining = parts.filter((p) => !COUNTRY.test(p));
  if (remaining.length > 1 && COUNTY.test(remaining[remaining.length - 1])) remaining.pop();

  const city = remaining.length > 1 ? remaining.pop() : null;
  return {
    street: remaining.join('\n') || null,
    city,
    postalCode,
    country: 'United Kingdom',
  };
};

module.exports = { splitUkAddress };
