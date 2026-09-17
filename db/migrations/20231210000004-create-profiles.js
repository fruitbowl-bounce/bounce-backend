'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('profiles', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      author: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      applicant_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      first_name_encrypted: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      last_name_encrypted: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      dob_encrypted: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      address_encrypted: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      postcode: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      state: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        unsigned: true,
      },
      metadata: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('profiles', ['user_id'], { name: 'index_profiles_on_user_id' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('profiles');
  }
};


