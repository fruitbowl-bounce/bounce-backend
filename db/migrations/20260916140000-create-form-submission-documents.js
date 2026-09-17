'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('form_submission_documents', {
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
      doc_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      original_filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      storage_key: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      size_bytes: {
        type: Sequelize.BIGINT,
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

    await queryInterface.addIndex('form_submission_documents', ['form_submission_id'], { name: 'index_form_submission_documents_on_form_submission_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('form_submission_documents');
  }
};
