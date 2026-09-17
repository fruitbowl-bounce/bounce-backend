'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('phones', {
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
      country: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      number_encrypted: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      number_index: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      validated_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('phones', ['user_id'], { name: 'index_phones_on_user_id' });
    await queryInterface.addIndex('phones', ['number_index'], { name: 'index_phones_on_number_index' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('phones');
  }
};

