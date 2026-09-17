'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comments', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unsigned: true,
      },
      author_uid: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: false,
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

    await queryInterface.addIndex('comments', ['user_id'], { name: 'index_comments_on_user_id' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('comments');
  }
};


