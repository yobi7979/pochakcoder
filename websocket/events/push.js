// SportsCoder WebSocket 푸시 이벤트 처리
const { Match, MatchList } = require('../../models');

/**
 * 푸시 관련 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const pushEvents = (socket, io) => {
  console.log('푸시 이벤트 설정 시작:', socket.id);
  
  // 통합 오버레이 방 참여 이벤트
  socket.on('join_unified_overlay', (data) => {
    try {
      const { listId } = data;
      const roomName = `list_overlay_${listId}`;
      
      console.log(`=== 통합 오버레이 방 조인 ===`);
      console.log(`socketId: ${socket.id}, listId: ${listId}, roomName: ${roomName}`);
      
      // 기존 방에서 나가기 (중복 방지)
      socket.rooms.forEach(room => {
        if (room.startsWith('list_overlay_')) {
          socket.leave(room);
          console.log(`기존 방에서 나감: ${room}`);
        }
      });
      
      // 새 방에 참가
      socket.join(roomName);
      
      // 소켓에 리스트 ID 저장 (연결 해제 시 사용)
      socket.listId = listId;
      
      console.log(`통합 오버레이 방 조인 완료: ${roomName}`);
      
      socket.emit('join_unified_overlay_response', {
        success: true,
        message: `방 ${roomName}에 참여했습니다.`,
        roomName: roomName
      });
    } catch (error) {
      console.error('join_unified_overlay 이벤트 처리 중 오류 발생:', error);
      socket.emit('join_unified_overlay_response', {
        success: false,
        error: '방 참여 중 오류가 발생했습니다.'
      });
    }
  });
  
  // 리스트 오버레이 경기 변경 이벤트 처리
  socket.on('push_to_list_overlay', async (data) => {
    try {
      const { listId, matchIndex, matchId, forceRefresh = false } = data;
      const roomName = `list_overlay_${listId}`;
      
      console.log(`=== 푸시 요청 수신 ===`);
      console.log(`listId: ${listId}, matchIndex: ${matchIndex}, matchId: ${matchId}, forceRefresh: ${forceRefresh}`);
      
      // 강제 새로고침 요청인 경우 캐시 무효화
      if (forceRefresh) {
        console.log(`강제 새로고침 요청: ${listId}`);
        // 기존 푸시 정보 초기화
        global.pushedMatches.delete(listId);
      }
      
      // matchId로 경기 정보를 직접 가져오기
      let actualMatch;
      if (matchId) {
        console.log(`matchId로 경기 조회: ${matchId}`);
        actualMatch = await Match.findByPk(matchId);
        if (!actualMatch) {
          console.log(`경기를 찾을 수 없음: ${matchId}`);
          socket.emit('push_to_list_overlay_response', { 
            success: false, 
            error: '경기를 찾을 수 없습니다.' 
          });
          return;
        }
      } else {
        // listId로 리스트 정보 가져오기
        const list = await MatchList.findByPk(listId);
        if (!list || !list.matches || list.matches.length === 0) {
          console.log(`리스트 또는 경기를 찾을 수 없음: ${listId}`);
          socket.emit('push_to_list_overlay_response', { 
            success: false, 
            error: '리스트 또는 경기를 찾을 수 없습니다.' 
          });
          return;
        }
        
        // matchIndex로 경기 선택
        const selectedMatch = list.matches[matchIndex];
        if (!selectedMatch) {
          console.log(`선택된 경기 인덱스가 유효하지 않음: ${matchIndex}`);
          socket.emit('push_to_list_overlay_response', { 
            success: false, 
            error: '선택된 경기 인덱스가 유효하지 않습니다.' 
          });
          return;
        }
        
        actualMatch = await Match.findByPk(selectedMatch.id);
        if (!actualMatch) {
          console.log(`실제 경기를 찾을 수 없음: ${selectedMatch.id}`);
          socket.emit('push_to_list_overlay_response', { 
            success: false, 
            error: '실제 경기를 찾을 수 없습니다.' 
          });
          return;
        }
      }
      
      console.log(`선택된 경기: ${actualMatch.id} (${actualMatch.home_team} vs ${actualMatch.away_team})`);
      
      // 푸시 정보 저장
      const pushInfo = {
        listId: listId,
        matchId: actualMatch.id,
        matchIndex: matchIndex,
        timestamp: Date.now()
      };
      
      global.pushedMatches.set(listId, pushInfo);
      console.log(`푸시 정보 저장:`, pushInfo);
      
      // 데이터베이스에 푸시 정보 저장
      const { savePushedMatchToDatabase } = require('../../server');
      if (savePushedMatchToDatabase) {
        await savePushedMatchToDatabase(listId, actualMatch.id, matchIndex);
      }
      
      // 리스트 오버레이 방에 경기 변경 알림 전송
      const pushData = {
        listId: listId,
        matchId: actualMatch.id,
        matchIndex: matchIndex,
        homeTeam: actualMatch.home_team,
        awayTeam: actualMatch.away_team,
        homeScore: actualMatch.home_score,
        awayScore: actualMatch.away_score,
        sportType: actualMatch.sport_type,
        forceRefresh: forceRefresh
      };
      
      console.log(`푸시 데이터 전송:`, pushData);
      io.to(roomName).emit('list_overlay_match_changed', pushData);
      
      // 응답 전송
      socket.emit('push_to_list_overlay_response', { 
        success: true, 
        message: '경기가 성공적으로 푸시되었습니다.',
        pushData: pushData
      });
      
      console.log(`푸시 완료: ${listId} -> ${actualMatch.id}`);
      
    } catch (error) {
      console.error('푸시 처리 중 오류 발생:', error);
      socket.emit('push_to_list_overlay_response', { 
        success: false, 
        error: '서버 오류가 발생했습니다.' 
      });
    }
  });
  
  console.log('푸시 이벤트 설정 완료:', socket.id);
};

module.exports = pushEvents;
