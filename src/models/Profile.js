const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../services/encryptionService');

const Profile = sequelize.define('profiles', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  author: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  applicant_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  first_name_encrypted: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
  last_name_encrypted: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
  dob_encrypted: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  address_encrypted: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
  postcode: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  state: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
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
  tableName: 'profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeSave: async (profile) => {
      if (profile._first_name !== undefined) {
        profile.first_name_encrypted = encrypt(profile._first_name);
        delete profile._first_name;
      }
      if (profile._last_name !== undefined) {
        profile.last_name_encrypted = encrypt(profile._last_name);
        delete profile._last_name;
      }
      if (profile._dob !== undefined) {
        profile.dob_encrypted = encrypt(profile._dob.toString());
        delete profile._dob;
      }
      if (profile._address !== undefined) {
        profile.address_encrypted = encrypt(profile._address);
        delete profile._address;
      }
    },
  },
});

Object.defineProperty(Profile.prototype, 'first_name', {
  get: function() {
    return this.first_name_encrypted ? decrypt(this.first_name_encrypted) : null;
  },
  set: function(value) {
    this._first_name = value;
  },
});

Object.defineProperty(Profile.prototype, 'last_name', {
  get: function() {
    return this.last_name_encrypted ? decrypt(this.last_name_encrypted) : null;
  },
  set: function(value) {
    this._last_name = value;
  },
});

Object.defineProperty(Profile.prototype, 'dob', {
  get: function() {
    return this.dob_encrypted ? decrypt(this.dob_encrypted) : null;
  },
  set: function(value) {
    this._dob = value;
  },
});

Object.defineProperty(Profile.prototype, 'address', {
  get: function() {
    return this.address_encrypted ? decrypt(this.address_encrypted) : null;
  },
  set: function(value) {
    this._address = value;
  },
});

Profile.prototype.fullName = function() {
  return `${this.first_name || ''} ${this.last_name || ''}`.trim();
};

module.exports = Profile;

