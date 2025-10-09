// 404 에러 핸들러
function notFoundHandler(req, res, next) {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
}

// 전역 에러 핸들러
function errorHandler(err, req, res, next) {
  // 로거가 있는 경우 에러 로깅
  if (req.logger) {
    req.logger.error('서버 오류:', err);
  } else {
    console.error('서버 오류:', err);
  }
  
  // 개발 환경에서는 스택 트레이스 포함
  const errorResponse = {
    error: '서버 오류가 발생했습니다.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  };
  
  res.status(500).json(errorResponse);
}

// 비동기 에러 래퍼
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler
};
