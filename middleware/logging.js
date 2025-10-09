const morgan = require('morgan');

// Morgan 로깅 미들웨어 설정
const morganConfig = morgan('dev');

// 커스텀 로깅 미들웨어
function customLogging(req, res, next) {
  // 요청 시작 시간 기록
  req.startTime = Date.now();
  
  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    if (req.logger) {
      req.logger.info('HTTP 요청', logData);
    }
  });
  
  next();
}

// Railway 환경에서 세션 디버깅 미들웨어
function sessionDebugging(req, res, next) {
  if (process.env.RAILWAY_ENVIRONMENT === 'production') {
    if (req.logger) {
      req.logger.info(`Railway 세션 디버깅: session=${!!req.session}, authenticated=${req.session?.authenticated}, username=${req.session?.username}`);
    }
  }
  next();
}

module.exports = {
  morganConfig,
  customLogging,
  sessionDebugging
};
