'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const templates = [
      {
        slug: 'growth',
        name: 'Business Growth Loan',
        description: 'Our lowest available interest rate with repayments spread over 6 years — designed to keep your monthly costs as low as possible.',
        apr_value: 9.0,
        factor_rate: null,
        term_months: 72,
        term_label: '6 years',
        features: JSON.stringify(['Lowest available APR', 'Fixed monthly repayments', 'No early repayment fees']),
        tag: 'Best value',
        tag_variant: 'value',
        sort_order: 0,
        active: true,
      },
      {
        slug: 'recommended',
        name: 'Unsecured Business Loan',
        description: 'A competitive unsecured loan with a 5-year term — no collateral required and a fast decision, balancing cost with repayment speed.',
        apr_value: 9.1,
        factor_rate: null,
        term_months: 60,
        term_label: '5 years',
        features: JSON.stringify(['No collateral required', 'Funds within 48 hours', 'Dedicated account manager']),
        tag: 'Recommended',
        tag_variant: 'recommended',
        sort_order: 1,
        active: true,
      },
      {
        slug: 'fast',
        name: 'Flexible Revenue Finance',
        description: 'Fast-access funding using a fixed factor rate — ideal when speed and flexibility matter most.',
        apr_value: null,
        factor_rate: 1.36,
        term_months: 12,
        term_label: '12 months',
        features: JSON.stringify(['Same-day decisions', 'Minimal paperwork', 'Flexible repayment term']),
        tag: 'Fastest',
        tag_variant: 'fast',
        sort_order: 2,
        active: true,
      },
    ].map((t) => ({ ...t, created_at: now, updated_at: now }));

    await queryInterface.bulkInsert('loan_offer_templates', templates);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('loan_offer_templates', {
      slug: ['growth', 'recommended', 'fast'],
    });
  }
};
