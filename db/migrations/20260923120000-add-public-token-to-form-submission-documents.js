'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submission_documents', 'public_token', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.addIndex('form_submission_documents', ['public_token'], {
      unique: true,
      name: 'index_form_submission_documents_on_public_token',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('form_submission_documents', 'index_form_submission_documents_on_public_token');
    await queryInterface.removeColumn('form_submission_documents', 'public_token');
  }
};
