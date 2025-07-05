const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sport_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  home_team: {
    type: DataTypes.STRING,
    allowNull: false
  },
  away_team: {
    type: DataTypes.STRING,
    allowNull: false
  },
  home_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  away_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  match_data: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'Matches'
});

module.exports = Match; 