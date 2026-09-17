const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Label = sequelize.define('labels', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unsigned: true,
  },
  key: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  value: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  scope: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'public',
  },
  description: {
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
  tableName: 'labels',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'key', 'scope'],
    },
  ],
});

module.exports = Label;

