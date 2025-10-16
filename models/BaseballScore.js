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
      unique: true,
      comment: '경기 ID (유니크)'
    },
    innings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        home: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0},
        away: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0}
      },
      comment: '홈팀/원정팀 이닝별 점수 (JSON)'
    },
    home_total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '홈팀 총 점수'
    },
    away_total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '원정팀 총 점수'
    }
  }, {
    tableName: 'BaseballScore',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['match_id'],
        name: 'baseball_score_match_id_unique'
      }
    ],
    comment: '야구 경기별 이닝 점수 저장 테이블 (JSON 구조)'
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
