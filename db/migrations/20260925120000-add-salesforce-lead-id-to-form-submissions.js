'use strict';

// Every application now gets a Salesforce Lead from its first save (email
// entered), and a Loan_Application__c only once it's completed. The existing
// salesforce_id column keeps holding the Loan_Application__c id; this one
// holds the Lead id.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'salesforce_lead_id', {
      type: Sequelize.STRING(30),
      allowNull: true,
      after: 'salesforce_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('form_submissions', 'salesforce_lead_id');
  }
};
