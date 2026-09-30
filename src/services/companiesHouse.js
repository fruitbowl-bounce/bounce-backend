const logger = require('../utils/logger');

const UPSTREAM = 'https://api.company-information.service.gov.uk';

const get = async (path) => {
  const response = await fetch(`${UPSTREAM}${path}`, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.COMPANIES_HOUSE_API_KEY}:`).toString('base64'),
      Accept: 'application/json',
    },
  });
  // Charges and PSC lists answer 404 for companies with none registered.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Companies House ${path} failed (${response.status})`);
  return response.json();
};

// The registered details the Salesforce Account needs: the company profile
// (status, dates, SIC codes, overdue flags, insolvency history), its charges
// register and its persons with significant control. Returns null when the
// company number isn't on the register (e.g. a manually typed company).
const fetchCompanyDetails = async (companyNumber) => {
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    logger.warn('COMPANIES_HOUSE_API_KEY not set, skipping Companies House details');
    return null;
  }
  const number = encodeURIComponent(String(companyNumber).trim().toUpperCase());
  const profile = await get(`/company/${number}`);
  if (!profile) return null;

  const [charges, pscs] = await Promise.all([
    get(`/company/${number}/charges?items_per_page=100`),
    get(`/company/${number}/persons-with-significant-control?items_per_page=100`),
  ]);
  return { profile, charges: charges?.items || [], pscs: pscs?.items || [] };
};

module.exports = { fetchCompanyDetails };
