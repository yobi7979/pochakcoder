const session = require('express-session');

// 세션 설정
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'sportscoder-secret-key-' + Math.random().toString(36).substring(2, 15),
  resave: true, // Railway에서 세션 유지를 위해 true로 변경
  saveUninitialized: true, // Railway에서 세션 유지를 위해 true로 변경
  rolling: true, // 세션 갱신 활성화
  cookie: {
    secure: false, // Railway에서 HTTPS 설정 문제로 false로 설정
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    sameSite: 'lax' // CSRF 보호
  }
};

// PostgreSQL 세션 스토어 설정 (프로덕션 환경)
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
  try {
    const pgSession = require('connect-pg-simple')(session);
    sessionConfig.store = new pgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true
    });
    console.log('PostgreSQL 세션 스토어 설정 완료');
  } catch (error) {
    console.warn('PostgreSQL 세션 스토어 설정 실패, 메모리 세션 사용:', error.message);
  }
} else {
  console.log('메모리 세션 스토어 사용 (개발 환경)');
}

module.exports = sessionConfig;
