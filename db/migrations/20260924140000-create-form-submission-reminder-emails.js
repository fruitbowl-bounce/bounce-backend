'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('form_submission_reminder_emails', {
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
      // One of the 8 keys in reminderRules.js — incomplete_1, incomplete_2,
      // offers_1, offers_2, offers_3, offer_selected, documents_unfinished,
      // documents_received.
      email_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
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

    // One send per (submission, email) — this is what stops a reminder
    // being sent twice if the scheduler tick overlaps or reruns.
    await queryInterface.addIndex('form_submission_reminder_emails', ['form_submission_id', 'email_key'], {
      unique: true,
      name: 'index_form_submission_reminder_emails_on_submission_and_key',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('form_submission_reminder_emails');
  }
};
