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
  // How far through the 6-stage funnel this applicant has actually gotten —
  // distinct from `status` above, which tracks Salesforce sync state, not
  // funnel progress. Updated on every partial save.
  funnel_stage: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  // Long, unguessable — this is what "continue your application" links use.
  // Deliberately separate from application_ref, which is short and shown to
  // the applicant on-screen, so it isn't safe to treat as a secret.
  resume_token: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
  },
  loan_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  funding_purpose: {
    type: DataTypes.STRING(100),
    allowNull: true,
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
    allowNull: true,
  },
  turnover_range: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  director_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  home_address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  owns_property: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
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
    allowNull: true,
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
    allowNull: true,
  },
  offer_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
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
