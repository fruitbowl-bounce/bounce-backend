// Creates a read-only "viewer" login for the admin panel: the applications
// list and details only (see viewerReadOnly in src/middleware/adminAuth.js).
// Prints a random password once. Usage:
//   docker compose exec backend node scripts/createViewer.js someone@example.com
const crypto = require('crypto');
const User = require('../src/models/User');

(async () => {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: node scripts/createViewer.js <email>');
  if (await User.findOne({ where: { email } })) throw new Error(`${email} already has an account`);

  const password = crypto.randomBytes(12).toString('base64url');
  await User.create({ email, password, role: 'viewer', state: 'active', level: 0, otp: false });
  console.log(`Viewer created: ${email}\nPassword: ${password}\nSend it privately.`);
  process.exit(0);
})().catch((error) => { console.error(error.message); process.exit(1); });
