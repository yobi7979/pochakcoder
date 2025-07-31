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
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending'
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
        defaultValue: {
            state: '경기 전',
            home_shots: 0,
            away_shots: 0,
            home_shots_on_target: 0,
            away_shots_on_target: 0,
            home_corners: 0,
            away_corners: 0,
            home_fouls: 0,
            away_fouls: 0
        }
    },

}, {
    sequelize,
    modelName: 'Match',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Match; 