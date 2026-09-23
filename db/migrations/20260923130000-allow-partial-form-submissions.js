'use strict';

// Lets a form_submissions row be created as soon as Stage 1 is completed
// (loan amount + company + email known, nothing past that yet) and filled
// in further as the applicant progresses, instead of requiring every field
// up front. Only application_ref and email stay mandatory — email is what
// triggers the very first save, so it's always present by then.
const NULLABLE_COLUMNS = [
  'loan_amount', 'funding_purpose', 'trading_time', 'turnover_range',
  'director_name', 'home_address', 'phone', 'owns_property',
  'company_name', 'offer_id', 'offer_name',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const typeByColumn = {
      loan_amount: Sequelize.DECIMAL(12, 2),
      funding_purpose: Sequelize.STRING(100),
      trading_time: Sequelize.STRING(50),
      turnover_range: Sequelize.STRING(50),
      director_name: Sequelize.STRING(255),
      home_address: Sequelize.TEXT,
      phone: Sequelize.STRING(50),
      owns_property: Sequelize.BOOLEAN,
      company_name: Sequelize.STRING(255),
      offer_id: Sequelize.STRING(50),
      offer_name: Sequelize.STRING(100),
    };

    for (const column of NULLABLE_COLUMNS) {
      await queryInterface.changeColumn('form_submissions', column, {
        type: typeByColumn[column],
        allowNull: true,
      });
    }

    await queryInterface.addColumn('form_submissions', 'funnel_stage', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn('form_submissions', 'resume_token', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.addIndex('form_submissions', ['resume_token'], {
      unique: true,
      name: 'index_form_submissions_on_resume_token',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('form_submissions', 'index_form_submissions_on_resume_token');
    await queryInterface.removeColumn('form_submissions', 'resume_token');
    await queryInterface.removeColumn('form_submissions', 'funnel_stage');

    const typeByColumn = {
      loan_amount: Sequelize.DECIMAL(12, 2),
      funding_purpose: Sequelize.STRING(100),
      trading_time: Sequelize.STRING(50),
      turnover_range: Sequelize.STRING(50),
      director_name: Sequelize.STRING(255),
      home_address: Sequelize.TEXT,
      phone: Sequelize.STRING(50),
      owns_property: Sequelize.BOOLEAN,
      company_name: Sequelize.STRING(255),
      offer_id: Sequelize.STRING(50),
      offer_name: Sequelize.STRING(100),
    };
    for (const column of NULLABLE_COLUMNS) {
      await queryInterface.changeColumn('form_submissions', column, {
        type: typeByColumn[column],
        allowNull: false,
      });
    }
  }
};
