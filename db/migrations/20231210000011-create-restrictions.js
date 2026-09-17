'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('restrictions', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      scope: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      code: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'enabled',
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('restrictions');
  }
};


