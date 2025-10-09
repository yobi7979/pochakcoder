// SportsCoder WebSocket 메인 진입점
const { handleConnection } = require('./connection');
const { setupEvents } = require('./events');

/**
 * WebSocket 연결 설정
 * @param {Object} io - Socket.IO 인스턴스
 */
module.exports = (io) => {
  console.log('WebSocket 모듈 초기화 중...');
  
  io.on('connection', (socket) => {
    console.log('클라이언트 연결됨:', socket.id);
    
    // 연결 처리
    handleConnection(socket, io);
    
    // 이벤트 설정
    setupEvents(socket, io);
  });
  
  console.log('WebSocket 모듈 초기화 완료');
};
