const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TeamLogo = sequelize.define('TeamLogo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sport_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: '종목 타입 (SOCCER, BASEBALL 등)'
    },
    team_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '팀 이름'
    },
    logo_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: '로고 파일 경로'
    },
    logo_bg_color: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: '#ffffff',
      comment: '로고 배경색 (HEX 또는 RGB)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '활성화 여부'
    }
  }, {
    tableName: 'TeamLogos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['sport_type', 'is_active']
      },
      {
        fields: ['logo_path']
      }
    ]
  });

  return TeamLogo;
};
