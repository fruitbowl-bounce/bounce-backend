'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('form_submission_directors', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      form_submission_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'form_submissions',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('form_submission_directors', ['form_submission_id'], { name: 'index_form_submission_directors_on_form_submission_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('form_submission_directors');
  }
};
