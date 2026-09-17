const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../services/encryptionService');
const { generateHash } = require('../utils/saltedCrc32');

const Document = sequelize.define('documents', {
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
  upload: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  doc_type: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  doc_expire: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  doc_number_encrypted: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  doc_number_index: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  doc_issue: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  doc_category: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  identificator: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  metadata: {
    type: DataTypes.TEXT,
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
  tableName: 'documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeSave: async (document) => {
      if (document._doc_number !== undefined) {
        document.doc_number_encrypted = encrypt(document._doc_number);
        document.doc_number_index = generateHash(document._doc_number);
        delete document._doc_number;
      }
    },
  },
});

Object.defineProperty(Document.prototype, 'doc_number', {
  get: function() {
    return this.doc_number_encrypted ? decrypt(this.doc_number_encrypted) : null;
  },
  set: function(value) {
    this._doc_number = value;
  },
});

module.exports = Document;

