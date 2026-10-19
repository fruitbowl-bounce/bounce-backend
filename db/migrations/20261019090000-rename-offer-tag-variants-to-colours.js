'use strict';

// Offer tag styles are named by colour now (BF-060, Joshua 19/10), not by
// what the tag used to say.
const RENAMES = [
  ['recommended', 'purple'],
  ['value', 'amber'],
  ['fast', 'blue'],
];

module.exports = {
  async up(queryInterface) {
    for (const [from, to] of RENAMES) {
      await queryInterface.bulkUpdate('loan_offer_templates', { tag_variant: to }, { tag_variant: from });
    }
  },

  async down(queryInterface) {
    // Green had no old name; it goes back to no style.
    await queryInterface.bulkUpdate('loan_offer_templates', { tag_variant: null }, { tag_variant: 'green' });
    for (const [from, to] of RENAMES) {
      await queryInterface.bulkUpdate('loan_offer_templates', { tag_variant: from }, { tag_variant: to });
    }
  },
};
