// SportsCoder WebSocket 일반 이벤트 처리

/**
 * 일반 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const generalEvents = (socket, io) => {
  console.log('일반 이벤트 설정 시작:', socket.id);

  // 모든 방에서 나가기 이벤트 처리
  socket.on('leave_all_rooms', () => {
    // 클라이언트가 참가한 모든 방에서 나가기
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room !== socket.id) { // 기본 소켓 ID 방은 제외
        socket.leave(room);
        console.log(`클라이언트 ${socket.id}가 방 ${room}에서 나감`);
      }
    });
    console.log(`클라이언트 ${socket.id}가 모든 방에서 나감`);
  });

  // 종목별 Room 참여 이벤트 처리
  socket.on('join_sport_room', (sportType) => {
    try {
      const roomName = `sport_${sportType}`;
      socket.join(roomName);
      
      // 상세 로깅 추가
      const room = io.sockets.adapter.rooms.get(roomName);
      const clientCount = room ? room.size : 0;
      
      console.log(`🔧 클라이언트 ${socket.id}가 종목별 Room 참여: ${roomName}`);
      console.log(`🔧 현재 Room 참여자 수: ${clientCount}`);
      
      // 참여 확인 이벤트 전송
      socket.emit('joined_sport_room', {
        success: true,
        roomName: roomName,
        sportType: sportType,
        clientCount: clientCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🔧 종목별 Room 참여 오류:', error);
      socket.emit('joined_sport_room', {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 테스트 이벤트 처리
  socket.on('test_event', (data) => {
    try {
      const { matchId, message, timestamp } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`테스트 이벤트 수신: matchId=${matchId}, message=${message}, timestamp=${timestamp}`);
      
      // 해당 방의 모든 클라이언트에게 테스트 이벤트 전송
      io.to(roomName).emit('test_event_response', {
        matchId: matchId,
        message: message,
        timestamp: timestamp,
        serverTime: Date.now()
      });
      
      console.log(`테스트 이벤트 응답을 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('테스트 이벤트 처리 중 오류 발생:', error);
      socket.emit('test_event_error', { error: '테스트 이벤트 처리에 실패했습니다.' });
    }
  });

  // 연결 해제 이벤트 처리
  socket.on('disconnect', () => {
    console.log(`클라이언트 ${socket.id} 연결 해제됨`);
  });

  console.log('일반 이벤트 설정 완료:', socket.id);
};

module.exports = generalEvents;
