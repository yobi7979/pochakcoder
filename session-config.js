const session = require('express-session');

// Railway Redis가 설정된 경우 Redis 사용, 아니면 메모리 사용
const getSessionConfig = () => {
  if (process.env.REDIS_URL) {
    const RedisStore = require('connect-redis')(session);
    const redis = require('redis');
    const client = redis.createClient({
      url: process.env.REDIS_URL
    });
    
    return {
      store: new RedisStore({ client }),
      secret: process.env.SESSION_SECRET || 'fallback-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24시간
      }
    };
  }
  
  // 메모리 세션 (개발용)
  return {
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000 // 24시간
    }
  };
};

module.exports = getSessionConfig;
