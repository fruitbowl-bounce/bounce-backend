const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Permission = sequelize.define('permissions', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  action: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  verb: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  path: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  topic: {
    type: DataTypes.STRING(255),
    allowNull: true,
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
  tableName: 'permissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (permission) => {
      if (permission.action) {
        permission.action = permission.action.toUpperCase();
      }
      if (permission.verb) {
        permission.verb = permission.verb.toUpperCase();
      }
    },
  },
});

module.exports = Permission;

