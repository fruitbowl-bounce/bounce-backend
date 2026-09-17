const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../services/encryptionService');

const APIKey = sequelize.define('apikeys', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  key_holder_account_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unsigned: true,
  },
  key_holder_account_type: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'User',
  },
  kid: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  algorithm: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  scope: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  secret_encrypted: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'active',
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
  tableName: 'apikeys',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeSave: async (apiKey) => {
      if (apiKey._secret !== undefined) {
        apiKey.secret_encrypted = encrypt(apiKey._secret);
        delete apiKey._secret;
      }
    },
  },
});

Object.defineProperty(APIKey.prototype, 'secret', {
  get: function() {
    return this.secret_encrypted ? decrypt(this.secret_encrypted) : null;
  },
  set: function(value) {
    this._secret = value;
  },
});

APIKey.prototype.active = function() {
  return this.state === 'active';
};

APIKey.findByKid = async function(kid) {
  return await this.findOne({ where: { kid } });
};

module.exports = APIKey;

