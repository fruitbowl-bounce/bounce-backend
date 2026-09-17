'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const addConstraintIfNotExists = async (tableName, constraintName, constraint) => {
      try {
        const [results] = await queryInterface.sequelize.query(
          `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = '${tableName}' 
           AND CONSTRAINT_NAME = '${constraintName}'`
        );
        if (results.length === 0) {
          await queryInterface.addConstraint(tableName, constraint);
        }
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    };

    await addConstraintIfNotExists('activities', 'fk_activities_user_id', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_activities_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('profiles', 'fk_profiles_user_id', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_profiles_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Skip phones foreign key - will be added after column type fix
    // await addConstraintIfNotExists('phones', 'fk_phones_user_id', {
    //   fields: ['user_id'],
    //   type: 'foreign key',
    //   name: 'fk_phones_user_id',
    //   references: {
    //     table: 'users',
    //     field: 'id',
    //   },
    //   onDelete: 'CASCADE',
    //   onUpdate: 'CASCADE',
    // });

    await addConstraintIfNotExists('documents', 'fk_documents_user_id', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_documents_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('labels', 'fk_labels_user_id', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_labels_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('data_storages', 'fk_data_storages_user_id', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_data_storages_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('comments', 'fk_comments_user_id', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_comments_user_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('apikeys', 'fk_apikeys_key_holder_account_id', {
      fields: ['key_holder_account_id'],
      type: 'foreign key',
      name: 'fk_apikeys_key_holder_account_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('service_accounts', 'fk_service_accounts_owner_id', {
      fields: ['owner_id'],
      type: 'foreign key',
      name: 'fk_service_accounts_owner_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await addConstraintIfNotExists('users', 'fk_users_referral_id', {
      fields: ['referral_id'],
      type: 'foreign key',
      name: 'fk_users_referral_id',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('activities', 'fk_activities_user_id');
    await queryInterface.removeConstraint('profiles', 'fk_profiles_user_id');
    await queryInterface.removeConstraint('phones', 'fk_phones_user_id');
    await queryInterface.removeConstraint('documents', 'fk_documents_user_id');
    await queryInterface.removeConstraint('labels', 'fk_labels_user_id');
    await queryInterface.removeConstraint('data_storages', 'fk_data_storages_user_id');
    await queryInterface.removeConstraint('comments', 'fk_comments_user_id');
    await queryInterface.removeConstraint('apikeys', 'fk_apikeys_key_holder_account_id');
    await queryInterface.removeConstraint('service_accounts', 'fk_service_accounts_owner_id');
    await queryInterface.removeConstraint('users', 'fk_users_referral_id');
  }
};

