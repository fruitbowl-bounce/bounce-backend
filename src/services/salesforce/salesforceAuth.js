const logger = require('../../utils/logger');

// Client-credentials tokens don't come back with a reliable expires_in on
// Salesforce, so refresh proactively well inside any session-timeout window
// rather than trusting a returned TTL.
const TOKEN_TTL_MS = 25 * 60 * 1000;

let cachedToken = null; // { accessToken, instanceUrl, expiresAt }

const isConfigured = () => Boolean(
  process.env.SALESFORCE_LOGIN_URL &&
  process.env.SALESFORCE_CLIENT_ID &&
  process.env.SALESFORCE_CLIENT_SECRET
);

const fetchNewToken = async () => {
  const loginUrl = process.env.SALESFORCE_LOGIN_URL.replace(/\/$/, '');
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SALESFORCE_CLIENT_ID,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET,
  });

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Salesforce auth failed: ${body.error || response.status} - ${body.error_description || ''}`);
  }

  return {
    accessToken: body.access_token,
    instanceUrl: body.instance_url,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
};

const getToken = async (forceRefresh = false) => {
  if (!isConfigured()) {
    throw new Error('Salesforce is not configured (SALESFORCE_LOGIN_URL/CLIENT_ID/CLIENT_SECRET missing)');
  }

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken;
  }

  cachedToken = await fetchNewToken();
  logger.info('Salesforce access token refreshed');
  return cachedToken;
};

module.exports = { getToken, isConfigured };
