// SportsCoder WebSocket 연결 처리
const { Match, MatchList } = require('../models');

/**
 * WebSocket 연결 처리
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const handleConnection = (socket, io) => {
  console.log('WebSocket 연결 처리 시작:', socket.id);
  
  // 연결 해제 이벤트
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제됨:', socket.id);
  });
  
  // 연결 성공 로그
  console.log('WebSocket 연결 처리 완료:', socket.id);
};

module.exports = { handleConnection };
