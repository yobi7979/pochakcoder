// SportsCoder WebSocket 타이머 이벤트 처리 - 단순화 버전
const { Match } = require('../../models');

// 전역 타이머 상태 관리
if (!global.timerStates) global.timerStates = new Map();

/**
 * 타이머 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const timerEvents = (socket, io) => {
  console.log('타이머 이벤트 설정 시작:', socket.id);

  // 타이머 제어 이벤트 처리 - 서버 중심 단순화
  socket.on('timer_control', async (data) => {
    try {
      const { matchId, action, minutes, seconds } = data;
      console.log(`타이머 제어 요청: matchId=${matchId}, action=${action}`);

      const roomName = `match_${matchId}`;
      const currentServerTime = Date.now();
      
      // 전역 타이머 상태 관리
      let timerData = global.timerStates.get(matchId);
      
      if (!timerData) {
        timerData = {
          startTime: 0,
          pausedTime: 0,
          isRunning: false,
          lastUpdateTime: currentServerTime
        };
        global.timerStates.set(matchId, timerData);
      }

      // 액션에 따른 타이머 상태 업데이트
      switch (action) {
        case 'start':
          if (!timerData.isRunning) {
            timerData.isRunning = true;
            timerData.startTime = currentServerTime;
            timerData.lastUpdateTime = currentServerTime;
            console.log(`타이머 시작: matchId=${matchId}, startTime=${timerData.startTime}`);
          }
          break;
          
        case 'stop':
        case 'pause':
          if (timerData.isRunning) {
            const elapsedTime = Math.floor((currentServerTime - timerData.startTime) / 1000);
            timerData.pausedTime += elapsedTime;
            timerData.isRunning = false;
            timerData.lastUpdateTime = currentServerTime;
            console.log(`타이머 정지: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
          }
          break;
          
        case 'reset':
          timerData.startTime = 0;
          timerData.pausedTime = 0;
          timerData.isRunning = false;
          timerData.lastUpdateTime = currentServerTime;
          console.log(`타이머 리셋: matchId=${matchId}`);
          break;
          
        case 'set':
          const targetTime = (minutes * 60) + seconds;
          timerData.pausedTime = targetTime;
          timerData.isRunning = false;
          timerData.startTime = 0;
          timerData.lastUpdateTime = currentServerTime;
          console.log(`타이머 설정: matchId=${matchId}, targetTime=${targetTime}`);
          break;
      }

      // 전역 상태 업데이트
      global.timerStates.set(matchId, timerData);

      // DB 업데이트
      try {
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          matchData.timer_startTime = timerData.startTime;
          matchData.timer_pausedTime = timerData.pausedTime;
          matchData.timer_isRunning = timerData.isRunning;
          matchData.timer_lastUpdateTime = timerData.lastUpdateTime;
          await match.update({ match_data: matchData });
          console.log(`타이머 DB 업데이트 완료: matchId=${matchId}`);
        }
      } catch (error) {
        console.error('타이머 DB 업데이트 실패:', error);
      }

      // 현재 시간 계산 및 전송
      let currentSeconds = timerData.pausedTime;
      if (timerData.isRunning && timerData.startTime) {
        const elapsedTime = Math.floor((currentServerTime - timerData.startTime) / 1000);
        currentSeconds = timerData.pausedTime + elapsedTime;
      }

      // 모든 클라이언트에게 타이머 상태 전송
      io.to(roomName).emit('timer_update', {
        matchId: matchId,
        currentSeconds: currentSeconds,
        isRunning: timerData.isRunning,
        startTime: timerData.startTime,
        pausedTime: timerData.pausedTime
      });

      console.log(`타이머 업데이트 전송 완료: matchId=${matchId}, action=${action}, currentSeconds=${currentSeconds}`);
      
    } catch (error) {
      console.error('타이머 제어 중 오류 발생:', error);
    }
  });

  // 타이머 상태 요청 이벤트 처리 - 서버 중심 단순화
  socket.on('request_timer_state', async (data) => {
    try {
      const { matchId } = data;
      console.log(`타이머 상태 요청: matchId=${matchId}`);

      const currentTime = Date.now();
      
      // 메모리에서 타이머 상태 확인
      let timerData = global.timerStates.get(matchId);
      
      if (!timerData) {
        // 데이터베이스에서 타이머 상태 복원 시도
        try {
          const match = await Match.findByPk(matchId);
          if (match && match.match_data) {
            const matchData = match.match_data;
            if (matchData.timer_startTime && matchData.timer_pausedTime !== undefined) {
              const isRunning = matchData.timer_isRunning || false;
              const pausedTime = matchData.timer_pausedTime || 0;
              
              // 서버 재시작 시 시간 복원 계산
              let currentSeconds = pausedTime;
              if (isRunning && matchData.timer_startTime) {
                const elapsedTime = Math.floor((currentTime - matchData.timer_startTime) / 1000);
                currentSeconds = pausedTime + elapsedTime;
              }
              
              timerData = {
                startTime: matchData.timer_startTime,
                pausedTime: pausedTime,
                isRunning: isRunning,
                lastUpdateTime: currentTime
              };
              
              // 메모리에 저장
              global.timerStates.set(matchId, timerData);
              
              console.log(`타이머 상태 복원: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${isRunning}`);
            }
          }
        } catch (error) {
          console.error('타이머 상태 복원 실패:', error);
        }
      }
      
      if (timerData) {
        let currentSeconds = timerData.pausedTime;
        if (timerData.isRunning && timerData.startTime) {
          const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
          currentSeconds = timerData.pausedTime + elapsedTime;
        }
        
        socket.emit('timer_status_response', {
          matchId: matchId,
          currentSeconds: currentSeconds,
          isRunning: timerData.isRunning
        });
      } else {
        socket.emit('timer_status_response', {
          matchId: matchId,
          currentSeconds: 0,
          isRunning: false
        });
      }
      
    } catch (error) {
      console.error('타이머 상태 요청 처리 중 오류 발생:', error);
    }
  });

  console.log('타이머 이벤트 설정 완료:', socket.id);
};

module.exports = timerEvents;
