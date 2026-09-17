'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Idempotent: no-ops if either env var is unset or a user with that email
// already exists (mirrors seed-permissions.js's "safe to re-run" style).
module.exports = {
  async up(queryInterface) {
    const email = (process.env.ADMIN_SEED_EMAIL || '').toLowerCase().trim();
    const password = process.env.ADMIN_SEED_PASSWORD;

    if (!email || !password) {
      console.log('Skipping admin seed: ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set');
      return;
    }

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email } }
    );
    if (existing.length > 0) {
      console.log(`Skipping admin seed: user ${email} already exists`);
      return;
    }

    const passwordDigest = await bcrypt.hash(password, 10);
    const uidPrefix = (process.env.UID_PREFIX || 'ID').toUpperCase();
    const uid = `${uidPrefix}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

    await queryInterface.bulkInsert('users', [{
      uid,
      email,
      password_digest: passwordDigest,
      role: 'superadmin',
      level: 0,
      otp: false,
      state: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    }]);

    console.log(`Seeded admin user: ${email}`);
  },

  async down(queryInterface) {
    const email = (process.env.ADMIN_SEED_EMAIL || '').toLowerCase().trim();
    if (!email) return;
    await queryInterface.bulkDelete('users', { email });
  }
};
