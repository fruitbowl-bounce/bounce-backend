'use strict';

// Admin panel invites: a superadmin adds someone by email and they set their
// own password from the link in the invite email. Only a SHA-256 of the
// link's token is stored.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'invite_token_digest', {
      type: Sequelize.STRING(64),
      allowNull: true,
      after: 'state',
    });
    await queryInterface.addColumn('users', 'invite_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'invite_token_digest',
    });
    await queryInterface.addIndex('users', ['invite_token_digest'], { name: 'index_users_on_invite_token_digest' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'index_users_on_invite_token_digest');
    await queryInterface.removeColumn('users', 'invite_expires_at');
    await queryInterface.removeColumn('users', 'invite_token_digest');
  }
};
