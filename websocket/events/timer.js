// SportsCoder WebSocket 타이머 이벤트 처리
const { Match } = require('../../models');

// 타이머 데이터를 메모리에 저장하는 Map (기존 server.js와 동일)
const matchTimerData = new Map();
const pendingDbUpdates = new Map(); // DB 업데이트 대기열
const DB_BATCH_INTERVAL = 5000; // 5초마다 배치 업데이트

// 시간차이 보정 설정 저장
const timeCorrectionSettings = new Map();

// 타이머 관리 함수들 (기존 server.js와 동일)
function startMatchTimer(matchId) {
    let timerData = matchTimerData.get(matchId);
    
    if (!timerData) {
        // 타이머 데이터가 없으면 새로 생성
        timerData = {
            startTime: Date.now(),
            pausedTime: 0,
            isRunning: true,
            matchId: matchId
        };
    } else {
        // 기존 타이머 데이터 업데이트
        if (timerData.isRunning) {
            // 이미 실행 중이면 아무것도 하지 않음
            console.log(`타이머가 이미 실행 중: matchId=${matchId}`);
            return;
        }
        
        const oldStartTime = timerData.startTime;
        const oldPausedTime = timerData.pausedTime;
        timerData.startTime = Date.now();  // 현재 시간을 시작 시간으로 설정
        timerData.isRunning = true;
        // pausedTime은 그대로 유지 (현재 시간에서 계속 시작)
        console.log(`기존 타이머 데이터 업데이트: matchId=${matchId}, oldStartTime=${oldStartTime}, oldPausedTime=${oldPausedTime}, newStartTime=${timerData.startTime}, pausedTime=${timerData.pausedTime}`);
    }
    
    matchTimerData.set(matchId, timerData);
    
    // DB 업데이트 대기열에 추가
    pendingDbUpdates.set(matchId, {
        timer_startTime: timerData.startTime,
        timer_pausedTime: timerData.pausedTime,
        isRunning: true,
        lastUpdateTime: Date.now()
    });
    
    console.log(`타이머 시작 완료: matchId=${matchId}, startTime=${timerData.startTime}, pausedTime=${timerData.pausedTime}, isRunning=${timerData.isRunning}`);
}

function stopMatchTimer(matchId, clientTime = null) {
    const timerData = matchTimerData.get(matchId);
    if (timerData && timerData.isRunning) {
        // 클라이언트에서 전송한 시간을 우선 사용, 없으면 서버에서 계산
        let pausedTime;
        if (clientTime !== null) {
            pausedTime = clientTime;
            console.log(`클라이언트 시간 사용: matchId=${matchId}, clientTime=${clientTime}`);
        } else {
            // 현재 경과 시간 계산
            const currentTime = Date.now();
            const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
            pausedTime = elapsedTime;
            console.log(`서버 시간 계산: matchId=${matchId}, elapsedTime=${elapsedTime}`);
        }
        
        timerData.pausedTime = pausedTime;
        timerData.isRunning = false;
        
        matchTimerData.set(matchId, timerData);
        
        // DB 업데이트 대기열에 추가
        pendingDbUpdates.set(matchId, {
            timer_startTime: timerData.startTime,
            timer_pausedTime: timerData.pausedTime,
            isRunning: false,
            lastUpdateTime: Date.now()
        });
        
        console.log(`타이머 정지: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
    }
}

function resetMatchTimer(matchId) {
    const timerData = {
        startTime: 0, // 리셋 시에는 startTime을 0으로 설정
        pausedTime: 0,
        isRunning: false,
        matchId: matchId
    };
    
    matchTimerData.set(matchId, timerData);
    
    // DB 업데이트 대기열에 추가
    pendingDbUpdates.set(matchId, {
        timer_startTime: timerData.startTime,
        timer_pausedTime: timerData.pausedTime,
        isRunning: false,
        lastUpdateTime: Date.now()
    });
    
    console.log(`타이머 리셋: matchId=${matchId}`);
}

function setMatchTimer(matchId, minutes, seconds) {
    const targetTime = (minutes * 60) + seconds;
    
    // 기존 타이머가 실행 중이었다면 정지
    const existingTimer = matchTimerData.get(matchId);
    if (existingTimer && existingTimer.isRunning) {
        const currentTime = Date.now();
        const elapsedTime = Math.floor((currentTime - existingTimer.startTime) / 1000);
        existingTimer.pausedTime = elapsedTime;
        existingTimer.isRunning = false;
        matchTimerData.set(matchId, existingTimer);
    }
    
    const timerData = {
        startTime: 0, // 설정 시에는 startTime을 0으로 설정하여 정확한 시간에서 시작
        pausedTime: targetTime,
        isRunning: false,
        matchId: matchId
    };
    
    matchTimerData.set(matchId, timerData);
    
    // DB 업데이트 대기열에 추가
    pendingDbUpdates.set(matchId, {
        timer_startTime: timerData.startTime,
        timer_pausedTime: timerData.pausedTime,
        isRunning: false,
        lastUpdateTime: Date.now()
    });
    
    console.log(`타이머 설정: matchId=${matchId}, minutes=${minutes}, seconds=${seconds}, targetTime=${targetTime}`);
}

/**
 * 타이머 관련 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const timerEvents = (socket, io) => {
  console.log('타이머 이벤트 설정 시작:', socket.id);

  // 타이머 동기화 이벤트 처리 (재연결 시) - 기존 server.js와 동일
  socket.on('timer_sync', async (data) => {
    try {
      const { matchId, currentSeconds, isRunning, startTime, pausedTime } = data;
      console.log(`타이머 동기화 요청: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${isRunning}`);
      
      // 메모리에서 타이머 데이터 업데이트
      const timerData = {
        startTime: startTime || Date.now(),
        pausedTime: pausedTime || currentSeconds || 0,
        isRunning: isRunning || false,
        matchId: matchId
      };
      
      matchTimerData.set(matchId, timerData);
      
      // DB에도 저장
      const match = await Match.findByPk(matchId);
      if (match) {
        const matchData = { ...match.match_data } || {};
        matchData.timer_startTime = timerData.startTime;
        matchData.timer_pausedTime = timerData.pausedTime;
        matchData.isRunning = timerData.isRunning;
        
        await match.update({ match_data: matchData });
        console.log(`타이머 동기화 완료: matchId=${matchId}`);
      }
      
      // 다른 클라이언트들에게 동기화된 타이머 상태 전송 (기존 server.js와 동일)
      const roomName = `match_${matchId}`;
      io.to(roomName).emit('timer_state', {
        matchId: matchId,
        currentSeconds: timerData.pausedTime,
        isRunning: timerData.isRunning,
        startTime: timerData.startTime,
        pausedTime: timerData.pausedTime
      });
      
      console.log(`타이머 동기화 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('타이머 동기화 중 오류 발생:', error);
    }
  });

  // 타이머 상태 요청 이벤트 처리 - 기존 server.js와 동일
  socket.on('request_timer_state', async (data) => {
    try {
      const { matchId } = data;
      console.log(`타이머 상태 요청: matchId=${matchId}`);
      
      // 메모리에서 타이머 데이터 가져오기
      let timerData = matchTimerData.get(matchId);
      
      if (!timerData) {
        // 메모리에 없으면 DB에서 복원
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          timerData = {
            startTime: matchData.timer_startTime || Date.now(),
            pausedTime: matchData.timer_pausedTime || 0,
            isRunning: matchData.isRunning || false,
            matchId: matchId
          };
          matchTimerData.set(matchId, timerData);
        } else {
          throw new Error('경기를 찾을 수 없습니다.');
        }
      }
      
      // 현재 시간 계산
      let currentSeconds = timerData.pausedTime;
      if (timerData.isRunning) {
        currentSeconds += Math.floor((Date.now() - timerData.startTime) / 1000);
      }
      
      socket.emit('timer_state', {
        matchId: matchId,
        currentSeconds: currentSeconds,
        isRunning: timerData.isRunning,
        startTime: timerData.startTime,
        pausedTime: timerData.pausedTime
      });
      console.log(`타이머 상태 응답 전송: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${timerData.isRunning}`);
    } catch (error) {
      console.error('타이머 상태 요청 처리 중 오류 발생:', error);
    }
  });

  // 타이머 제어 이벤트 처리 - 기존 server.js와 동일
  socket.on('timer_control', async (data) => {
    try {
      const { matchId, action, minutes, seconds, currentTime } = data;
      console.log(`타이머 제어 요청: matchId=${matchId}, action=${action}, minutes=${minutes}, seconds=${seconds}, currentTime=${currentTime}`);
      
      if (!matchTimerData) {
        matchTimerData = new Map();
      }
      let timerData = matchTimerData.get(matchId);
      
      if (!timerData) {
        timerData = {
          startTime: null,
          pausedTime: 0,
          isRunning: false,
          matchId: matchId
        };
        matchTimerData.set(matchId, timerData);
      }
      
      let updatedCurrentTime = currentTime;
      
      switch (action) {
        case 'start':
          if (!timerData.isRunning) {
            // 🎯 서버 시간을 기준으로 타이머 시작 (시간차이 문제 해결)
            timerData.startTime = Date.now(); // 서버 시간 사용
            timerData.isRunning = true;
            console.log(`타이머 시작: matchId=${matchId}, startTime=${timerData.startTime} (서버 시간 기준)`);
          }
          break;
        case 'pause':
        case 'stop': // 기존 server.js와 동일하게 stop도 처리
          if (timerData.isRunning) {
            timerData.pausedTime = updatedCurrentTime;
            timerData.isRunning = false;
            console.log(`타이머 일시정지/정지: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
          }
          break;
        case 'reset':
          timerData.startTime = null;
          timerData.pausedTime = 0;
          timerData.isRunning = false;
          updatedCurrentTime = 0;
          console.log(`타이머 재설정: matchId=${matchId}`);
          break;
        case 'set':
          timerData.pausedTime = (minutes * 60) + seconds;
          timerData.isRunning = false;
          updatedCurrentTime = timerData.pausedTime;
          console.log(`타이머 설정: matchId=${matchId}, minutes=${minutes}, seconds=${seconds}`);
          break;
        case 'update': // 수동 업데이트 (예: 점수판에서 시간 직접 변경)
          timerData.pausedTime = currentTime;
          updatedCurrentTime = currentTime;
          console.log(`타이머 수동 업데이트: matchId=${matchId}, currentTime=${currentTime}`);
          break;
      }
      
      // DB에도 저장
      const match = await Match.findByPk(matchId);
      if (match) {
        const matchData = { ...match.match_data } || {};
        matchData.timer_startTime = timerData.startTime;
        matchData.timer_pausedTime = timerData.pausedTime;
        matchData.isRunning = timerData.isRunning;
        await match.update({ match_data: matchData });
      }
      
      // 모든 클라이언트에게 변경된 타이머 상태 전송 (기존 server.js와 동일)
      const roomName = `match_${matchId}`;
      
      // 기존 server.js와 동일한 전용 이벤트 전송
      if (action === 'start') {
        // 타이머 시작 전용 이벤트 전송
        io.to(roomName).emit('timer_started', {
          matchId: matchId,
          startTime: timerData.startTime,
          pausedTime: timerData.pausedTime,
          isRunning: timerData.isRunning
        });
        console.log(`타이머 시작 이벤트 전송: matchId=${matchId}`);
      } else if (action === 'stop' || action === 'pause') {
        // 타이머 정지 전용 이벤트 전송
        io.to(roomName).emit('timer_stopped', {
          matchId: matchId,
          startTime: timerData.startTime,
          pausedTime: timerData.pausedTime,
          isRunning: timerData.isRunning
        });
        console.log(`타이머 정지 이벤트 전송: matchId=${matchId}`);
      } else if (action === 'reset') {
        // 타이머 리셋 전용 이벤트 전송
        io.to(roomName).emit('timer_reset', {
          matchId: matchId,
          startTime: timerData.startTime,
          pausedTime: timerData.pausedTime,
          isRunning: timerData.isRunning
        });
        console.log(`타이머 리셋 이벤트 전송: matchId=${matchId}`);
      }
      
      // 기존 server.js와 동일한 timer_updated 이벤트 전송
      io.to(roomName).emit('timer_updated', {
        matchId: matchId,
        currentSeconds: updatedCurrentTime,
        isRunning: timerData.isRunning,
        minute: Math.floor(updatedCurrentTime / 60),
        second: updatedCurrentTime % 60,
        startTime: timerData.startTime,
        pausedTime: timerData.pausedTime
      });
      
      // 리스트 오버레이에도 타이머 업데이트 전송 (기존 server.js와 동일)
      const rooms = Array.from(io.sockets.adapter.rooms.keys()).filter(room => room.startsWith('list_overlay_'));
      rooms.forEach(room => {
        io.to(room).emit('timer_updated', {
          matchId: matchId,
          currentSeconds: updatedCurrentTime,
          isRunning: timerData.isRunning,
          minute: Math.floor(updatedCurrentTime / 60),
          second: updatedCurrentTime % 60,
          startTime: timerData.startTime,
          pausedTime: timerData.pausedTime
        });
      });
      
      console.log(`타이머 업데이트 전송 완료: matchId=${matchId}, action=${action}, currentSeconds=${updatedCurrentTime}`);
      
    } catch (error) {
      console.error('타이머 제어 처리 중 오류 발생:', error);
    }
  });
  
  // 시간차이 측정 요청 처리
  socket.on('time_sync_request', function(data) {
    const { clientTime, matchId } = data;
    const serverTime = Date.now();
    const timeDifference = serverTime - clientTime;
    
    console.log(`시간차이 측정: 클라이언트=${clientTime}, 서버=${serverTime}, 차이=${timeDifference}ms`);
    
    // 클라이언트에 시간차이 전송
    socket.emit('time_sync_response', {
      matchId: matchId,
      clientTime: clientTime,
      serverTime: serverTime,
      timeDifference: timeDifference,
      timestamp: Date.now()
    });
  });
  
  // 시간차이 보정 설정 토글
  socket.on('time_correction_toggle', function(data) {
    const { matchId, enabled, timeDifference } = data;
    
    console.log(`시간차이 보정 설정: matchId=${matchId}, enabled=${enabled}, timeDifference=${timeDifference}ms`);
    
    // 보정 설정 저장
    timeCorrectionSettings.set(matchId, {
      enabled: enabled,
      timeDifference: timeDifference,
      timestamp: Date.now()
    });
    
    // 해당 경기의 모든 클라이언트에 보정 설정 전송
    io.to(`match_${matchId}`).emit('time_correction_updated', {
      matchId: matchId,
      enabled: enabled,
      timeDifference: timeDifference
    });
  });

  console.log('타이머 이벤트 설정 완료:', socket.id);
};

module.exports = timerEvents;

