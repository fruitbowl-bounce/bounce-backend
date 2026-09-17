'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('form_submissions', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      application_ref: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'new',
      },
      loan_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      funding_purpose: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      marketing_consent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      trading_time: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      turnover_range: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      director_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      home_address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      owns_property: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      director_confirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      company_external_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      company_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      company_number: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      company_address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      offer_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      offer_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      offer_apr: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      offer_term: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      offer_monthly_repayment: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      offer_max_amount: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      offer_factor_rate: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: true,
      },
      offer_tag: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      salesforce_id: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      salesforce_synced_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      salesforce_sync_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      submitted_ip: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex('form_submissions', ['application_ref'], { unique: true, name: 'index_form_submissions_on_application_ref' });
    await queryInterface.addIndex('form_submissions', ['email'], { name: 'index_form_submissions_on_email' });
    await queryInterface.addIndex('form_submissions', ['company_name'], { name: 'index_form_submissions_on_company_name' });
    await queryInterface.addIndex('form_submissions', ['company_number'], { name: 'index_form_submissions_on_company_number' });
    await queryInterface.addIndex('form_submissions', ['funding_purpose'], { name: 'index_form_submissions_on_funding_purpose' });
    await queryInterface.addIndex('form_submissions', ['status'], { name: 'index_form_submissions_on_status' });
    await queryInterface.addIndex('form_submissions', ['salesforce_id'], { name: 'index_form_submissions_on_salesforce_id' });
    await queryInterface.addIndex('form_submissions', ['created_at'], { name: 'index_form_submissions_on_created_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('form_submissions');
  }
};
