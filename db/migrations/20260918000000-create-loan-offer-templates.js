'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('loan_offer_templates', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      apr_value: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      factor_rate: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: true,
      },
      term_months: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      term_label: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      features: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '[]',
      },
      tag: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      tag_variant: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('loan_offer_templates', ['slug'], { unique: true, name: 'index_loan_offer_templates_on_slug' });
    await queryInterface.addIndex('loan_offer_templates', ['active', 'sort_order'], { name: 'index_loan_offer_templates_on_active_sort_order' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('loan_offer_templates');
  }
};
