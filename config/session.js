const session = require('express-session');

// 세션 설정
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'sportscoder-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
};

// PostgreSQL 세션 스토어 설정 (프로덕션 환경)
if (process.env.DATABASE_URL || process.env.NODE_ENV === 'production') {
  try {
    const pgSession = require('connect-pg-simple')(session);
    sessionConfig.store = new pgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions'
    });
  } catch (error) {
    console.warn('PostgreSQL 세션 스토어 설정 실패, 메모리 세션 사용:', error.message);
  }
}

module.exports = sessionConfig;
