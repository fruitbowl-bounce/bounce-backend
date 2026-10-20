'use strict';

// BF-064: "No tag" now hides the tag. Offers that have tag text but no
// style (or one we don't know) were shown in amber, so they keep amber
// rather than losing their tag.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE loan_offer_templates
      SET tag_variant = 'amber'
      WHERE tag IS NOT NULL AND TRIM(tag) <> ''
        AND (tag_variant IS NULL OR tag_variant NOT IN ('purple', 'amber', 'blue', 'green'))
    `);
  },

  async down() {
    // Nothing to undo: which rows had no style isn't recorded.
  },
};
