const { DataTypes } = require('sequelize');

const TeamInfo = (sequelize) => {
  return sequelize.define('TeamInfo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    match_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Matches',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    sport_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'SOCCER'
    },
    team_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    team_type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['home', 'away']]
      }
    },
    team_color: {
      type: DataTypes.STRING(7),
      defaultValue: '#000000'
    },
    team_header: {
      type: DataTypes.STRING
    },
    logo_path: {
      type: DataTypes.STRING(500),
      defaultValue: null
    },
    logo_bg_color: {
      type: DataTypes.STRING(7),
      defaultValue: '#FFFFFF'
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'TeamInfo',
    indexes: [
      {
        unique: true,
        fields: ['match_id', 'team_type'],
        name: 'unique_match_team_type'
      }
    ]
  });
};

module.exports = TeamInfo;
