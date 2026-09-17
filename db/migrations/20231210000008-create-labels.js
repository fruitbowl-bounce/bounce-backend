'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('labels', {
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
      key: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      scope: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'public',
      },
      description: {
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

    await queryInterface.addIndex('labels', ['user_id'], { name: 'index_labels_on_user_id' });
    await queryInterface.addIndex('labels', ['user_id', 'key', 'scope'], { 
      unique: true, 
      name: 'index_labels_on_user_id_and_key_and_scope' 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('labels');
  }
};


