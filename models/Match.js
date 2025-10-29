const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Match extends Model {}

Match.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true
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
    home_team_color: {
        type: DataTypes.STRING,
        defaultValue: '#1e40af'
    },
    away_team_color: {
        type: DataTypes.STRING,
        defaultValue: '#1e40af'
    },
    home_team_header: {
        type: DataTypes.STRING,
        defaultValue: 'HOME'
    },
    away_team_header: {
        type: DataTypes.STRING,
        defaultValue: 'AWAY'
    },
    home_score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    away_score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending'
    },
    match_data: {
        type: DataTypes.JSONB,  // PostgreSQL JSONB 타입으로 변경
        defaultValue: {}
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    sequelize,
    modelName: 'Match',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'Matches'
});

module.exports = Match; 