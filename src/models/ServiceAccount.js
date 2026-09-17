const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateUID } = require('../utils/uidGenerator');

const ServiceAccount = sequelize.define('service_accounts', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  uid: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  owner_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unsigned: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'service_account',
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  state: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'pending',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'service_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: async (account) => {
      if (!account.uid || account.uid === '') {
        const checkUniqueness = async (uid) => {
          const User = require('./User');
          const ServiceAccount = require('./ServiceAccount');
          const userExists = await User.findOne({ where: { uid } });
          const serviceAccountExists = await ServiceAccount.findOne({ where: { uid } });
          return !!(userExists || serviceAccountExists);
        };
        account.uid = await generateUID(process.env.UID_PREFIX || 'SI', checkUniqueness);
      }
    },
  },
});

module.exports = ServiceAccount;

