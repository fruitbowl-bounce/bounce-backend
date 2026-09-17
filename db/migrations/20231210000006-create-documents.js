'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
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
      upload: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      doc_type: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      doc_expire: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      doc_number_encrypted: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      doc_number_index: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      doc_issue: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      doc_category: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      identificator: {
        type: Sequelize.STRING(255),
        allowNull: true,
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

    await queryInterface.addIndex('documents', ['user_id'], { name: 'index_documents_on_user_id' });
    await queryInterface.addIndex('documents', ['doc_number_index'], { name: 'index_documents_on_doc_number_index' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('documents');
  }
};


