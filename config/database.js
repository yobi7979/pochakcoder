const path = require('path');

// 데이터베이스 설정
const databaseConfig = {
  // SQLite 설정 (개발 환경)
  sqlite: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../sports.db'),
    logging: false,
    define: {
      timestamps: true,
      underscored: true
    }
  },
  
  // PostgreSQL 설정 (프로덕션 환경)
  postgres: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sportscoder',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    logging: false,
    define: {
      timestamps: true,
      underscored: true
    }
  }
};

// 환경에 따른 데이터베이스 설정 선택
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    // Railway 또는 다른 클라우드 환경
    return {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      logging: false,
      define: {
        timestamps: true,
        underscored: true
      }
    };
  } else if (process.env.NODE_ENV === 'production') {
    return databaseConfig.postgres;
  } else {
    return databaseConfig.sqlite;
  }
};

module.exports = {
  databaseConfig,
  getDatabaseConfig
};
