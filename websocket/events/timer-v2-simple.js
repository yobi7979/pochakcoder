// SportsCoder 단순화된 서버 타이머 시스템 v2
// 서버 중심의 단순한 타이머 시스템 - 컨트롤 패널에서만 제어 가능

const { Match, Settings } = require('../../models');

// 전역 타이머 상태 관리 (메모리)
if (!global.timerV2States) global.timerV2States = new Map();

/**
 * 단순화된 서버 타이머 시스템 v2 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const timerV2SimpleEvents = (socket, io) => {
    console.log('단순화된 서버 타이머 시스템 v2 이벤트 설정 시작:', socket.id);
    
    // 서버 타이머 제어 이벤트 (컨트롤 패널에서만 사용)
    socket.on('server_timer_control', async (data) => {
        try {
            const { matchId, action, timeValue } = data;
            console.log(`서버 타이머 제어: matchId=${matchId}, action=${action}`);
            
            const roomName = `match_${matchId}`;
            const currentServerTime = Date.now();
            
            // 전역 타이머 상태 관리
            let timerData = global.timerV2States.get(matchId);
            
            if (!timerData) {
                timerData = {
                    startTime: 0,
                    pausedTime: 0,
                    isRunning: false,
                    lastUpdateTime: currentServerTime
                };
                global.timerV2States.set(matchId, timerData);
            }

            // 액션에 따른 타이머 상태 업데이트
            switch (action) {
                case 'start':
                    if (!timerData.isRunning) {
                        timerData.isRunning = true;
                        timerData.startTime = currentServerTime;
                        timerData.lastUpdateTime = currentServerTime;
                        console.log(`서버 타이머 시작: matchId=${matchId}, startTime=${timerData.startTime}`);
                    }
                    break;
                    
                case 'stop':
                case 'pause':
                    if (timerData.isRunning) {
                        const elapsedTime = Math.round((currentServerTime - timerData.startTime) / 1000);
                        timerData.pausedTime += elapsedTime;
                        timerData.isRunning = false;
                        timerData.lastUpdateTime = currentServerTime;
                        console.log(`서버 타이머 정지: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
                    }
                    break;
                    
                case 'reset':
                    timerData.startTime = 0;
                    timerData.pausedTime = 0;
                    timerData.isRunning = false;
                    timerData.lastUpdateTime = currentServerTime;
                    console.log(`서버 타이머 리셋: matchId=${matchId}`);
                    break;
                    
                case 'set':
                    const targetTime = timeValue || 0;
                    timerData.pausedTime = targetTime;
                    timerData.isRunning = false;
                    timerData.startTime = 0;
                    timerData.lastUpdateTime = currentServerTime;
                    console.log(`서버 타이머 설정: matchId=${matchId}, targetTime=${targetTime}`);
                    break;
            }

            // 전역 상태 업데이트
            global.timerV2States.set(matchId, timerData);

            // DB에 타이머 상태 저장
            try {
                const match = await Match.findByPk(matchId);
                if (match) {
                    const matchData = match.match_data || {};
                    matchData.server_timer_startTime = timerData.startTime;
                    matchData.server_timer_pausedTime = timerData.pausedTime;
                    matchData.server_timer_isRunning = timerData.isRunning;
                    matchData.server_timer_lastUpdateTime = timerData.lastUpdateTime;
                    await match.update({ match_data: matchData });
                    console.log(`서버 타이머 DB 저장 완료: matchId=${matchId}`);
                }
            } catch (error) {
                console.error('서버 타이머 DB 저장 실패:', error);
            }

            // 현재 시간 계산
            let currentSeconds = timerData.pausedTime;
            if (timerData.isRunning && timerData.startTime) {
                const elapsedTime = Math.round((currentServerTime - timerData.startTime) / 1000);
                currentSeconds = timerData.pausedTime + elapsedTime;
            }

            // 컨트롤 패널에 즉시 응답
            socket.emit('server_timer_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime
            });

            // 오버레이 페이지에 전송 (최종 아웃풋)
            io.to(roomName).emit('server_timer_update', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime
            });

            console.log(`서버 타이머 업데이트 전송 완료: matchId=${matchId}, currentSeconds=${currentSeconds}`);
            
        } catch (error) {
            console.error('서버 타이머 제어 중 오류 발생:', error);
        }
    });

    // 서버 타이머 상태 요청 이벤트 (단순화)
    socket.on('request_server_timer_state', async (data) => {
        try {
            const { matchId } = data;
            console.log(`서버 타이머 상태 요청: matchId=${matchId}`);

            // 메모리에서 타이머 상태 확인
            let timerData = global.timerV2States.get(matchId);
            
            if (!timerData) {
                // 기본 상태로 초기화
                timerData = {
                    startTime: null,
                    pausedTime: 0,
                    isRunning: false,
                    lastUpdateTime: Date.now()
                };
                global.timerV2States.set(matchId, timerData);
            }

            // 현재 시간 계산
            let currentSeconds = timerData.pausedTime;
            if (timerData.isRunning && timerData.startTime) {
                const elapsedTime = Math.round((Date.now() - timerData.startTime) / 1000);
                currentSeconds = timerData.pausedTime + elapsedTime;
            }
            
            // 컨트롤 패널에 즉시 응답
            socket.emit('server_timer_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime
            });
            
            console.log(`서버 타이머 상태 전송: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${timerData.isRunning}`);
            
        } catch (error) {
            console.error('서버 타이머 상태 요청 처리 중 오류 발생:', error);
        }
    });

    // 실시간 타이머 동기화를 위한 주기적 브로드캐스트
    setInterval(() => {
        try {
            // 모든 활성 타이머에 대해 상태 브로드캐스트
            for (const [matchId, timerData] of global.timerV2States.entries()) {
                if (timerData.isRunning) {
                    const currentTime = Date.now();
                    const elapsedTime = Math.round((currentTime - timerData.startTime) / 1000);
                    const currentSeconds = timerData.pausedTime + elapsedTime;
                    
                    // 해당 경기의 모든 클라이언트에게 실시간 업데이트 전송
                    const roomName = `match_${matchId}`;
                    io.to(roomName).emit('server_timer_update', {
                        matchId: matchId,
                        currentSeconds: currentSeconds,
                        isRunning: timerData.isRunning,
                        startTime: timerData.startTime,
                        pausedTime: timerData.pausedTime
                    });
                }
            }
        } catch (error) {
            console.error('실시간 타이머 동기화 중 오류 발생:', error);
        }
    }, 1000); // 1초마다 실행

    // 타이머 모드 변경 이벤트 (컨트롤 패널에서만 사용)
    socket.on('timer_mode_change', async (data) => {
        try {
            const { matchId, newMode } = data;
            console.log(`타이머 모드 변경 요청: matchId=${matchId}, newMode=${newMode}`);
            
            // Settings 테이블에 타이머 모드 저장
            const settingKey = `timer_mode_${matchId}`;
            
            try {
                // 기존 설정 확인
                let setting = await Settings.findOne({ where: { key: settingKey } });
                
                if (setting) {
                    // 기존 설정 업데이트
                    await setting.update({ 
                        value: newMode,
                        description: `타이머 모드: ${newMode}`
                    });
                    console.log(`타이머 모드 업데이트: ${settingKey} = ${newMode}`);
                } else {
                    // 새 설정 생성
                    await Settings.create({
                        key: settingKey,
                        value: newMode,
                        description: `타이머 모드: ${newMode}`
                    });
                    console.log(`타이머 모드 생성: ${settingKey} = ${newMode}`);
                }
                
                // 컨트롤 패널에 응답
                socket.emit('timer_mode_updated', {
                    matchId: matchId,
                    currentMode: newMode
                });
                
            } catch (error) {
                console.error('타이머 모드 저장 실패:', error);
                socket.emit('timer_mode_error', {
                    matchId: matchId,
                    error: '타이머 모드 저장에 실패했습니다.'
                });
            }
            
        } catch (error) {
            console.error('타이머 모드 변경 처리 중 오류 발생:', error);
        }
    });

    // 타이머 모드 요청 이벤트
    socket.on('request_timer_mode', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 모드 요청: matchId=${matchId}`);
            
            const settingKey = `timer_mode_${matchId}`;
            
            try {
                const setting = await Settings.findOne({ where: { key: settingKey } });
                
                if (setting) {
                    console.log(`타이머 모드 발견: ${settingKey} = ${setting.value}`);
                    socket.emit('timer_mode_response', {
                        matchId: matchId,
                        currentMode: setting.value
                    });
                } else {
                    console.log(`타이머 모드 없음: ${settingKey} (기본값: server-timer)`);
                    socket.emit('timer_mode_response', {
                        matchId: matchId,
                        currentMode: 'server-timer'
                    });
                }
                
            } catch (error) {
                console.error('타이머 모드 조회 실패:', error);
                socket.emit('timer_mode_response', {
                    matchId: matchId,
                    currentMode: 'server-timer'
                });
            }
            
        } catch (error) {
            console.error('타이머 모드 요청 처리 중 오류 발생:', error);
        }
    });

    console.log('단순화된 서버 타이머 시스템 v2 이벤트 설정 완료:', socket.id);
};

module.exports = timerV2SimpleEvents;