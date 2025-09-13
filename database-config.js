const { Sequelize } = require('sequelize');

// Railway 환경 변수에서 데이터베이스 URL 가져오기
const getDatabaseConfig = () => {
  // Railway PostgreSQL이 설정된 경우
  if (process.env.DATABASE_URL) {
    return {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    };
  }
  
  // 로컬 개발 환경 (SQLite)
  return {
    dialect: 'sqlite',
    storage: './sports.db',
    logging: false
  };
};

module.exports = getDatabaseConfig;
