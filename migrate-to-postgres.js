const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// PostgreSQL 연결 설정
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

async function migrateToPostgres() {
  try {
    console.log('PostgreSQL 연결 테스트...');
    await sequelize.authenticate();
    console.log('PostgreSQL 연결 성공!');
    
    // 테이블 생성
    console.log('테이블 생성 중...');
    await sequelize.sync({ force: true });
    console.log('테이블 생성 완료!');
    
    console.log('마이그레이션 완료!');
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  migrateToPostgres();
}

module.exports = migrateToPostgres;
