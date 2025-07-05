const { DataTypes } = require('sequelize');
const sequelize = require('./index').sequelize;

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sport_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  template_type: {
    type: DataTypes.ENUM('control', 'overlay'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'templates'
});

module.exports = Template; 