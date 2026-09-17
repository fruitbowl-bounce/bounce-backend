const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateUID } = require('../utils/uidGenerator');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  uid: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    validate: {
      len: [4, 12],
      is: /^[a-zA-Z0-9]+$/,
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.VIRTUAL,
  },
  password_digest: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'member',
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1024],
      isJSON(value) {
        if (value && value !== '') {
          try {
            JSON.parse(value);
          } catch (e) {
            throw new Error('Data must be valid JSON');
          }
        }
      },
    },
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  otp: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  state: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'pending',
  },
  referral_id: {
    type: DataTypes.BIGINT,
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
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: async (user) => {
      if (!user.uid || user.uid === '') {
        const checkUniqueness = async (uid) => {
          const User = require('./User');
          const ServiceAccount = require('./ServiceAccount');
          const userExists = await User.findOne({ where: { uid } });
          const serviceAccountExists = await ServiceAccount.findOne({ where: { uid } });
          return !!(userExists || serviceAccountExists);
        };
        user.uid = await generateUID(process.env.UID_PREFIX || 'ID', checkUniqueness);
      }
      if (user.email) {
        user.email = user.email.toLowerCase().trim();
      }
      if (user.username) {
        user.username = user.username.toLowerCase();
      }
    },
    beforeCreate: async (user) => {
      if (!user.password_digest && !user.password) {
        user.password_digest = await bcrypt.hash(Math.random().toString(36).slice(-30), 10);
      }
      if (user.password) {
        const plainPassword = String(user.password).trim();
        user.password_digest = await bcrypt.hash(plainPassword, 10);
        delete user.password;
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        const plainPassword = String(user.password).trim();
        user.password_digest = await bcrypt.hash(plainPassword, 10);
        delete user.password;
      }
      if (user.changed('username') && user.username) {
        user.username = user.username.toLowerCase();
      }
    },
  },
});

User.prototype.authenticate = async function(password) {
  if (!password || !this.password_digest) {
    return false;
  }
  try {
    return await bcrypt.compare(String(password).trim(), this.password_digest);
  } catch (error) {
    return false;
  }
};

User.prototype.asPayload = function() {
  return {
    uid: this.uid,
    username: this.username,
    email: this.email,
    referral_id: this.referral_id,
    role: this.role,
    level: this.level,
    state: this.state,
  };
};

User.prototype.referral_uid = async function() {
  if (!this.referral_id) return null;
  const referralUser = await User.findByPk(this.referral_id);
  return referralUser ? referralUser.uid : null;
};

User.prototype.asJsonForEventApi = async function() {
  const referralUid = await this.referral_uid();
  return {
    uid: this.uid,
    username: this.username,
    email: this.email,
    role: this.role,
    level: this.level,
    otp: this.otp,
    state: this.state,
    referral_uid: referralUid,
    created_at: this.created_at.toISOString(),
    updated_at: this.updated_at.toISOString(),
  };
};

User.prototype.active = function() {
  return this.state === 'active';
};

User.prototype.superadmin = function() {
  return this.role === 'superadmin';
};

module.exports = User;

