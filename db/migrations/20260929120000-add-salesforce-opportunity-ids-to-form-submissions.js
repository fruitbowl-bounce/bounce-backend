'use strict';

// Loan_Application__c is retired: once offers are shown, the Lead is
// converted into an Account, Contact and Opportunity, and every later sync
// writes to those three records instead. salesforce_id keeps the old
// Loan_Application__c id for applications synced before the switch.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'salesforce_opportunity_id', {
      type: Sequelize.STRING(30),
      allowNull: true,
      after: 'salesforce_lead_id',
    });
    await queryInterface.addColumn('form_submissions', 'salesforce_contact_id', {
      type: Sequelize.STRING(30),
      allowNull: true,
      after: 'salesforce_opportunity_id',
    });
    await queryInterface.addColumn('form_submissions', 'salesforce_account_id', {
      type: Sequelize.STRING(30),
      allowNull: true,
      after: 'salesforce_contact_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('form_submissions', 'salesforce_account_id');
    await queryInterface.removeColumn('form_submissions', 'salesforce_contact_id');
    await queryInterface.removeColumn('form_submissions', 'salesforce_opportunity_id');
  }
};
