'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      uid: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      username: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_digest: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'member',
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      otp: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      state: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'pending',
      },
      referral_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('users', ['email'], { unique: true, name: 'index_users_on_email' });
    await queryInterface.addIndex('users', ['uid'], { unique: true, name: 'index_users_on_uid' });
    await queryInterface.addIndex('users', ['username'], { unique: true, name: 'index_users_on_username' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};


