const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FormSubmission = sequelize.define('form_submissions', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  application_ref: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'new',
  },
  loan_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  funding_purpose: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  marketing_consent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  trading_time: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  turnover_range: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  director_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  home_address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  owns_property: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  director_confirmed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  company_external_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  company_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  company_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  company_address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  offer_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  offer_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  offer_apr: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  offer_term: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  offer_monthly_repayment: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  offer_max_amount: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  offer_factor_rate: {
    type: DataTypes.DECIMAL(6, 3),
    allowNull: true,
  },
  offer_tag: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  salesforce_id: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  salesforce_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  salesforce_sync_error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  submitted_ip: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.STRING(255),
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
  tableName: 'form_submissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = FormSubmission;
