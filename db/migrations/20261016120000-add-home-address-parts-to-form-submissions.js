'use strict';

// The home address in parts (BF-057, Joshua 16/10): about 1 in 5 applications
// came through with no house number, town or postcode. home_address stays as
// the one-line version for the admin panel and emails.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'home_house', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'home_address',
    });
    await queryInterface.addColumn('form_submissions', 'home_street', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'home_house',
    });
    await queryInterface.addColumn('form_submissions', 'home_town', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'home_street',
    });
    await queryInterface.addColumn('form_submissions', 'home_postcode', {
      type: Sequelize.STRING(10),
      allowNull: true,
      after: 'home_town',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('form_submissions', 'home_postcode');
    await queryInterface.removeColumn('form_submissions', 'home_town');
    await queryInterface.removeColumn('form_submissions', 'home_street');
    await queryInterface.removeColumn('form_submissions', 'home_house');
  }
};
