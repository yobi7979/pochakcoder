// SportsCoder WebSocket 이벤트 설정
const pushEvents = require('./push');
const timerEvents = require('./timer');
const matchEvents = require('./match');
const overlayEvents = require('./overlay');
const teamEvents = require('./team');
const generalEvents = require('./general');

/**
 * WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const setupEvents = (socket, io) => {
  console.log('WebSocket 이벤트 설정 시작:', socket.id);
  
  // 모든 WebSocket 이벤트 핸들러 설정
  pushEvents(socket, io);        // 푸시 관련 이벤트 (2개)
  timerEvents(socket, io);       // 타이머 관련 이벤트 (4개) - 서버 중심 시스템
  matchEvents(socket, io);       // 경기 관련 이벤트 (8개)
  overlayEvents(socket, io);     // 오버레이 관련 이벤트 (8개)
  teamEvents(socket, io);        // 팀 관련 이벤트 (8개)
  generalEvents(socket, io);     // 일반 이벤트 (3개)
  
  console.log('WebSocket 이벤트 설정 완료:', socket.id);
};

module.exports = { setupEvents };
