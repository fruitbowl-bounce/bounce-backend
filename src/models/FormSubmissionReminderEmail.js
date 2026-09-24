const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FormSubmissionReminderEmail = sequelize.define('form_submission_reminder_emails', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  form_submission_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  email_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'form_submission_reminder_emails',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = FormSubmissionReminderEmail;
