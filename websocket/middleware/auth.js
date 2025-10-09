// SportsCoder WebSocket 인증 미들웨어

/**
 * WebSocket 인증 미들웨어
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Function} next - 다음 미들웨어 함수
 */
const websocketAuth = (socket, next) => {
  console.log('WebSocket 인증 미들웨어 실행:', socket.id);
  
  // 임시로 인증 우회 (개발 환경)
  console.log('WebSocket 인증 우회 (개발 환경)');
  next();
  
  // 세션에서 사용자 정보 확인 (주석 처리)
  // const session = socket.request.session;
  // 
  // if (!session || !session.userId) {
  //   console.log('WebSocket 인증 실패: 세션 없음');
  //   return next(new Error('인증이 필요합니다.'));
  // }
  // 
  // console.log('WebSocket 인증 성공:', session.userId);
  // next();
};

module.exports = websocketAuth;
