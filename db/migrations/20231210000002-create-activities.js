'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('activities', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      target_uid: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      user_ip: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      user_ip_country: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      topic: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      result: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('activities', ['user_id'], { name: 'index_activities_on_user_id' });
    await queryInterface.addIndex('activities', ['target_uid'], { name: 'index_activities_on_target_uid' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('activities');
  }
};


