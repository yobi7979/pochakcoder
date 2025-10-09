// SportsCoder WebSocket 오버레이 이벤트 처리
const { Match } = require('../../models');

/**
 * 오버레이 관련 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const overlayEvents = (socket, io) => {
  console.log('오버레이 이벤트 설정 시작:', socket.id);

  // 스코어보드 토글 이벤트 처리
  socket.on('toggle_scoreboard', (data) => {
    const { matchId } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`스코어보드 토글: matchId=${matchId}`);
    
    // 해당 방의 모든 클라이언트에게 스코어보드 토글 이벤트 전송
    io.to(roomName).emit('scoreboard_toggled', {
      matchId: matchId
    });
    
    console.log(`스코어보드 토글 이벤트를 방 ${roomName}에 전송함`);
  });

  // VS 오버레이 토글 이벤트 처리
  socket.on('toggle_vs_overlay', (data) => {
    const { matchId } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`VS 오버레이 토글: matchId=${matchId}`);
    
    // 해당 방의 모든 클라이언트에게 VS 오버레이 토글 이벤트 전송
    io.to(roomName).emit('vs_overlay_toggled', {
      matchId: matchId
    });
    
    console.log(`VS 오버레이 토글 이벤트를 방 ${roomName}에 전송함`);
  });

  // 하단 스트립 토글 이벤트 처리
  socket.on('toggle_bottom_strip', (data) => {
    const { matchId, homeGoals, awayGoals } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`하단 스트립 토글: matchId=${matchId}, goals=${homeGoals}-${awayGoals}`);
    
    // 해당 방의 모든 클라이언트에게 하단 스트립 토글 이벤트 전송
    io.to(roomName).emit('bottom_strip_toggled', {
      matchId: matchId,
      homeGoals: homeGoals,
      awayGoals: awayGoals
    });
    
    console.log(`하단 스트립 토글 이벤트를 방 ${roomName}에 전송함`);
  });

  // 야구 오버레이 가시성 업데이트 이벤트 처리
  socket.on('baseball_overlay_visibility_update', async (data) => {
    try {
      const { matchId, overlayType, isVisible } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`야구 오버레이 가시성 업데이트: matchId=${matchId}, type=${overlayType}, visible=${isVisible}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        const matchData = { ...match.match_data } || {};
        matchData[`${overlayType}_visible`] = isVisible;
        
        await match.update({ match_data: matchData });
        console.log(`야구 오버레이 가시성 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 야구 오버레이 가시성 업데이트 이벤트 전송
      io.to(roomName).emit('baseball_overlay_visibility_updated', {
        matchId: matchId,
        overlayType: overlayType,
        isVisible: isVisible
      });
      
      console.log(`야구 오버레이 가시성 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('야구 오버레이 가시성 업데이트 처리 중 오류 발생:', error);
      socket.emit('baseball_overlay_visibility_error', { error: '야구 오버레이 가시성 업데이트에 실패했습니다.' });
    }
  });

  // 추가 박스 토글 이벤트 처리
  socket.on('toggleExtraBox', (data) => {
    const { matchId } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`추가 박스 토글: matchId=${matchId}`);
    
    // 해당 방의 모든 클라이언트에게 추가 박스 토글 이벤트 전송
    io.to(roomName).emit('extra_box_toggled', {
      matchId: matchId
    });
    
    console.log(`추가 박스 토글 이벤트를 방 ${roomName}에 전송함`);
  });

  // 추가 박스 텍스트 업데이트 이벤트 처리
  socket.on('updateExtraBoxText', (data) => {
    const { matchId, text } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`추가 박스 텍스트 업데이트: matchId=${matchId}, text=${text}`);
    
    // 해당 방의 모든 클라이언트에게 추가 박스 텍스트 업데이트 이벤트 전송
    io.to(roomName).emit('extra_box_text_updated', {
      matchId: matchId,
      text: text
    });
    
    console.log(`추가 박스 텍스트 업데이트 이벤트를 방 ${roomName}에 전송함`);
  });

  // 토너먼트 텍스트 업데이트 이벤트 처리
  socket.on('update_tournament_text', async (data) => {
    try {
      const { matchId, tournamentText } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`토너먼트 텍스트 업데이트: matchId=${matchId}, text=${tournamentText}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        const matchData = { ...match.match_data } || {};
        matchData.tournament_text = tournamentText;
        
        await match.update({ match_data: matchData });
        console.log(`토너먼트 텍스트 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 토너먼트 텍스트 업데이트 이벤트 전송
      io.to(roomName).emit('tournament_text_updated', {
        matchId: matchId,
        tournamentText: tournamentText
      });
      
      console.log(`토너먼트 텍스트 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('토너먼트 텍스트 업데이트 처리 중 오류 발생:', error);
      socket.emit('tournament_text_update_error', { error: '토너먼트 텍스트 업데이트에 실패했습니다.' });
    }
  });

  // 리스트 오버레이 참여 이벤트 처리
  socket.on('join_list_overlay', (listId) => {
    const roomName = `list_overlay_${listId}`;
    socket.join(roomName);
    console.log(`클라이언트 ${socket.id}가 리스트 오버레이 방 ${roomName}에 참여함`);
  });

  console.log('오버레이 이벤트 설정 완료:', socket.id);
};

module.exports = overlayEvents;
