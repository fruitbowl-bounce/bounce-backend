const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../services/encryptionService');
const { generateHash } = require('../utils/saltedCrc32');
const { parsePhoneNumber, isValidPhoneNumber, parsePhoneNumberFromString } = require('libphonenumber-js');

const Phone = sequelize.define('phones', {
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
  country: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  number_encrypted: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  number_index: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  validated_at: {
    type: DataTypes.DATE,
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
  tableName: 'phones',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (phone) => {
      if (phone._number !== undefined) {
        try {
          const phoneNumber = parsePhoneNumber(phone._number);
          if (phoneNumber && phoneNumber.isValid()) {
            phone.country = phoneNumber.country || 'US';
            phone._number = phoneNumber.number;
          } else {
            phone.country = phone.country || 'US';
          }
        } catch (error) {
          phone.country = phone.country || 'US';
        }
      }
    },
    beforeCreate: (phone) => {
      if (!phone.code) {
        phone.code = Math.floor(10000 + Math.random() * 90000).toString();
      }
    },
    beforeSave: async (phone) => {
      if (phone._number) {
        phone.number_encrypted = encrypt(phone._number);
        phone.number_index = generateHash(phone._number);
      }
    },
  },
});

Object.defineProperty(Phone.prototype, 'number', {
  get: function() {
    return this.number_encrypted ? decrypt(this.number_encrypted) : null;
  },
  set: function(value) {
    this._number = value;
  },
});

Phone.sanitize = (unsafePhone) => {
  return unsafePhone.toString().replace(/\D/g, '');
};

Phone.parse = (unsafePhone) => {
  if (!unsafePhone) return null;
  
  const trimmed = unsafePhone.toString().trim();
  
  try {
    if (trimmed.startsWith('+')) {
      return parsePhoneNumber(trimmed);
    }
    
    const sanitized = Phone.sanitize(trimmed);
    if (sanitized.startsWith('91') && sanitized.length >= 12) {
      return parsePhoneNumber('+' + sanitized);
    }
    
    return parsePhoneNumber(trimmed);
  } catch (error) {
    try {
      const sanitized = Phone.sanitize(trimmed);
      if (sanitized.length >= 10) {
        return parsePhoneNumber('+' + sanitized);
      }
    } catch (err) {
      return null;
    }
    return null;
  }
};

Phone.valid = (unsafePhone) => {
  const parsed = Phone.parse(unsafePhone);
  return parsed ? parsed.isValid() : false;
};

Phone.international = (unsafePhone) => {
  const parsed = Phone.parse(unsafePhone);
  return parsed ? parsed.number : Phone.sanitize(unsafePhone);
};

Phone.findByNumber = async function(number, attrs = {}) {
  const numberIndex = generateHash(number);
  return await this.findOne({ where: { ...attrs, number_index: numberIndex } });
};

module.exports = Phone;

