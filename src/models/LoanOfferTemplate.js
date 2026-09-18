const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Admin-editable funding options shown on Stage 4 of the public application
// funnel. `features` is stored as a JSON-encoded string (TEXT column, no
// native JSON type dependency) and parsed/stringified at the model boundary.
const LoanOfferTemplate = sequelize.define('loan_offer_templates', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  slug: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  apr_value: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  factor_rate: {
    type: DataTypes.DECIMAL(6, 3),
    allowNull: true,
  },
  term_months: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  term_label: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  features: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    get() {
      const raw = this.getDataValue('features');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    set(value) {
      this.setDataValue('features', JSON.stringify(Array.isArray(value) ? value : []));
    },
  },
  tag: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  tag_variant: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'loan_offer_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

LoanOfferTemplate.prototype.asJson = function asJson() {
  return {
    id: this.slug,
    name: this.name,
    description: this.description,
    aprValue: this.apr_value !== null ? Number(this.apr_value) : undefined,
    apr: this.apr_value !== null ? `${Number(this.apr_value)}% APR` : undefined,
    factorRate: this.factor_rate !== null ? Number(this.factor_rate) : undefined,
    termMonths: this.term_months,
    term: this.term_label,
    features: this.features,
    tag: this.tag ?? undefined,
    tagVariant: this.tag_variant ?? undefined,
  };
};

LoanOfferTemplate.prototype.asAdminJson = function asAdminJson() {
  return {
    id: this.id,
    slug: this.slug,
    name: this.name,
    description: this.description,
    apr_value: this.apr_value !== null ? Number(this.apr_value) : null,
    factor_rate: this.factor_rate !== null ? Number(this.factor_rate) : null,
    term_months: this.term_months,
    term_label: this.term_label,
    features: this.features,
    tag: this.tag,
    tag_variant: this.tag_variant,
    sort_order: this.sort_order,
    active: this.active,
    created_at: this.created_at,
    updated_at: this.updated_at,
  };
};

module.exports = LoanOfferTemplate;
