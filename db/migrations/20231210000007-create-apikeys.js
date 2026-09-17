'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('apikeys', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      key_holder_account_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unsigned: true,
      },
      key_holder_account_type: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'User',
      },
      kid: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      algorithm: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      scope: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      secret_encrypted: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'active',
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

    await queryInterface.addIndex('apikeys', ['kid'], { unique: true, name: 'index_apikeys_on_kid' });
    await queryInterface.addIndex('apikeys', ['key_holder_account_type', 'key_holder_account_id'], { 
      name: 'idx_apikey_on_account' 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('apikeys');
  }
};


