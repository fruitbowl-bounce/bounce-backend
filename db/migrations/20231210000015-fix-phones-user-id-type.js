'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop existing foreign key if it exists
    try {
      await queryInterface.removeConstraint('phones', 'fk_phones_user_id');
    } catch (error) {
      // Constraint doesn't exist, continue
    }

    // Change column type
    await queryInterface.changeColumn('phones', 'user_id', {
      type: Sequelize.BIGINT,
      allowNull: false,
      unsigned: true,
    });

    // Re-add foreign key with correct type
    await queryInterface.addConstraint('phones', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_phones_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('phones', 'fk_phones_user_id');
    await queryInterface.changeColumn('phones', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      unsigned: true,
    });
  }
};

