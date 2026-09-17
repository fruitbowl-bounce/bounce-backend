const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Restriction = sequelize.define('restrictions', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  category: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  scope: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  value: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  code: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'enabled',
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
  tableName: 'restrictions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Restriction;

