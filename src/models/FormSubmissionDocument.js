const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FormSubmissionDocument = sequelize.define('form_submission_documents', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  form_submission_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  doc_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  original_filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  storage_key: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  size_bytes: {
    type: DataTypes.BIGINT,
    allowNull: true,
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
  tableName: 'form_submission_documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = FormSubmissionDocument;
