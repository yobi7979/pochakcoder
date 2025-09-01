const { Sequelize } = require('sequelize');
const path = require('path');

// Railway 환경에서는 환경 변수에서 데이터베이스 URL을 가져옵니다
const databaseUrl = process.env.DATABASE_URL || 'sqlite:sports.db';

let sequelize;

if (databaseUrl.startsWith('postgres://')) {
  // PostgreSQL 연결 (Railway에서 제공하는 경우)
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  // SQLite 연결 (로컬 개발용)
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'sports.db'),
    logging: false
  });
}

module.exports = sequelize; 