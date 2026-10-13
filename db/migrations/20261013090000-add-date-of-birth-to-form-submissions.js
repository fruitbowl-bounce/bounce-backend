'use strict';

// Applicant's date of birth, asked on Stage 3 (Joshua, 13/10: applications
// can't be processed without it).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'date_of_birth', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: 'phone',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('form_submissions', 'date_of_birth');
  }
};
