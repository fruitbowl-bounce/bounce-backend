'use strict';

// The furthest Opportunity Applicant_Status__c the sync has handled (BF-012),
// so the 24-hour "Documents Required" check only queues each application once.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'salesforce_applicant_status', {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: 'salesforce_sync_error',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('form_submissions', 'salesforce_applicant_status');
  }
};
