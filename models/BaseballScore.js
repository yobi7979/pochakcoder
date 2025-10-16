const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BaseballScore = sequelize.define('BaseballScore', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    match_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '경기 ID'
    },
    team_type: {
      type: DataTypes.ENUM('home', 'away'),
      allowNull: false,
      comment: '팀 타입 (홈팀/원정팀)'
    },
    inning: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '이닝 번호 (1-9)',
      validate: {
        min: 1,
        max: 9
      }
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '해당 이닝 점수',
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'BaseballScore',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['match_id', 'team_type', 'inning'],
        name: 'baseball_score_match_team_inning'
      },
      {
        fields: ['match_id'],
        name: 'baseball_score_match_id'
      }
    ],
    comment: '야구 이닝별 점수 저장 테이블'
  });

  // 관계 설정
  BaseballScore.associate = (models) => {
    // Match와의 관계 (선택사항)
    BaseballScore.belongsTo(models.Match, {
      foreignKey: 'match_id',
      targetKey: 'id',
      as: 'match'
    });
  };

  return BaseballScore;
};
