'use strict';

// The email this application put on the Brevo marketing list, so it can be
// taken off again if the applicant unticks consent or changes their email.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'brevo_contact_email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'salesforce_sync_error',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('form_submissions', 'brevo_contact_email');
  }
};
