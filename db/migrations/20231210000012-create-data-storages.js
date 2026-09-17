'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('data_storages', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unsigned: true,
      },
      title: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: false,
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

    await queryInterface.addIndex('data_storages', ['user_id', 'title'], { 
      unique: true, 
      name: 'index_data_storages_on_user_id_and_title' 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('data_storages');
  }
};


