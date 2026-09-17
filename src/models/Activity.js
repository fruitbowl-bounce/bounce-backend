const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Activity = sequelize.define('activities', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  target_uid: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isIn: [['admin', 'user']],
    },
  },
  user_ip: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  user_ip_country: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  topic: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  result: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isIn: [['succeed', 'failed', 'denied']],
    },
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'activities',
  timestamps: false,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Activity;

