const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DataStorage = sequelize.define('data_storages', {
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
  title: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false,
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
  tableName: 'data_storages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'title'],
    },
  ],
});

module.exports = DataStorage;

