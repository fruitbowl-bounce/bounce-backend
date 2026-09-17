'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('permissions', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      verb: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      path: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      topic: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex('permissions', ['topic'], { name: 'index_permissions_on_topic' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('permissions');
  }
};


