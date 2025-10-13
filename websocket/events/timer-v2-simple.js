// SportsCoder 단순화된 타이머 시스템 v2
// 복잡한 하이브리드 로직을 제거하고 서버 중심의 단순한 타이머 시스템

const { Match } = require('../../models');

// 전역 타이머 상태 관리
if (!global.timerV2States) global.timerV2States = new Map();

/**
 * 단순화된 타이머 시스템 v2 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const timerV2SimpleEvents = (socket, io) => {
    console.log('단순화된 타이머 시스템 v2 이벤트 설정 시작:', socket.id);
    
    // 하이브리드 타이머 제어 이벤트 (컨트롤 페이지에서 사용)
    socket.on('timer_v2_hybrid_control', async (data) => {
        try {
            const { matchId, action, clientStartTime, currentTime } = data;
            console.log(`단순화된 타이머 v2 제어: matchId=${matchId}, action=${action}`);
            
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
                        console.log(`타이머 v2 시작: matchId=${matchId}, startTime=${timerData.startTime}`);
                    }
                    break;
                    
                case 'stop':
                case 'pause':
                    if (timerData.isRunning) {
                        const elapsedTime = Math.floor((currentServerTime - timerData.startTime) / 1000);
                        timerData.pausedTime += elapsedTime;
                        timerData.isRunning = false;
                        timerData.lastUpdateTime = currentServerTime;
                        console.log(`타이머 v2 정지: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
                    }
                    break;
                    
                case 'reset':
                    timerData.startTime = 0;
                    timerData.pausedTime = 0;
                    timerData.isRunning = false;
                    timerData.lastUpdateTime = currentServerTime;
                    console.log(`타이머 v2 리셋: matchId=${matchId}`);
                    break;
                    
                case 'set':
                    const targetTime = currentTime || 0;
                    timerData.pausedTime = targetTime;
                    timerData.isRunning = false;
                    timerData.startTime = 0;
                    timerData.lastUpdateTime = currentServerTime;
                    console.log(`타이머 v2 설정: matchId=${matchId}, targetTime=${targetTime}`);
                    break;
            }

            // 전역 상태 업데이트
            global.timerV2States.set(matchId, timerData);

            // DB 업데이트
            try {
                const match = await Match.findByPk(matchId);
                if (match) {
                    const matchData = match.match_data || {};
                    matchData.timer_v2_startTime = timerData.startTime;
                    matchData.timer_v2_pausedTime = timerData.pausedTime;
                    matchData.timer_v2_isRunning = timerData.isRunning;
                    matchData.timer_v2_lastUpdateTime = timerData.lastUpdateTime;
                    await match.update({ match_data: matchData });
                    console.log(`타이머 v2 DB 업데이트 완료: matchId=${matchId}`);
                }
            } catch (error) {
                console.error('타이머 v2 DB 업데이트 실패:', error);
            }

            // 현재 시간 계산 및 전송
            let currentSeconds = timerData.pausedTime;
            if (timerData.isRunning && timerData.startTime) {
                const elapsedTime = Math.floor((currentServerTime - timerData.startTime) / 1000);
                currentSeconds = timerData.pausedTime + elapsedTime;
                console.log(`타이머 v2 계산: pausedTime=${timerData.pausedTime}, elapsedTime=${elapsedTime}, currentSeconds=${currentSeconds}`);
            } else {
                console.log(`타이머 v2 정지 상태: pausedTime=${timerData.pausedTime}, isRunning=${timerData.isRunning}`);
            }

            // 모든 클라이언트에게 타이머 상태 전송
            io.to(roomName).emit('timer_v2_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime,
                mode: 'hybrid'
            });

            console.log(`타이머 v2 업데이트 전송 완료: matchId=${matchId}, action=${action}, currentSeconds=${currentSeconds}`);
            
        } catch (error) {
            console.error('타이머 v2 제어 중 오류 발생:', error);
        }
    });

    // 타이머 v2 상태 요청 이벤트
    socket.on('request_timer_v2_state', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 v2 상태 요청: matchId=${matchId}`);

            const currentTime = Date.now();
            
            // 메모리에서 타이머 상태 확인
            let timerData = global.timerV2States.get(matchId);
            
            if (!timerData) {
                // 데이터베이스에서 타이머 상태 복원 시도
                try {
                    const match = await Match.findByPk(matchId);
                    if (match && match.match_data) {
                        const matchData = match.match_data;
                        if (matchData.timer_v2_startTime && matchData.timer_v2_pausedTime !== undefined) {
                            const isRunning = matchData.timer_v2_isRunning || false;
                            const pausedTime = matchData.timer_v2_pausedTime || 0;
                            
                            // 서버 재시작 시 시간 복원 계산
                            let currentSeconds = pausedTime;
                            if (isRunning && matchData.timer_v2_startTime) {
                                const elapsedTime = Math.floor((currentTime - matchData.timer_v2_startTime) / 1000);
                                currentSeconds = pausedTime + elapsedTime;
                            }
                            
                            timerData = {
                                startTime: matchData.timer_v2_startTime,
                                pausedTime: pausedTime,
                                isRunning: isRunning,
                                lastUpdateTime: currentTime
                            };
                            
                            // 메모리에 저장
                            global.timerV2States.set(matchId, timerData);
                            
                            console.log(`타이머 v2 상태 복원: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${isRunning}`);
                        }
                    }
                } catch (error) {
                    console.error('타이머 v2 상태 복원 실패:', error);
                }
            }
            
            if (timerData) {
                let currentSeconds = timerData.pausedTime;
                if (timerData.isRunning && timerData.startTime) {
                    const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
                    currentSeconds = timerData.pausedTime + elapsedTime;
                }
                
                socket.emit('timer_v2_state', {
                    matchId: matchId,
                    currentSeconds: currentSeconds,
                    isRunning: timerData.isRunning,
                    startTime: timerData.startTime,
                    pausedTime: timerData.pausedTime,
                    mode: 'hybrid'
                });
            } else {
                socket.emit('timer_v2_state', {
                    matchId: matchId,
                    currentSeconds: 0,
                    isRunning: false,
                    startTime: 0,
                    pausedTime: 0,
                    mode: 'hybrid'
                });
            }
            
        } catch (error) {
            console.error('타이머 v2 상태 요청 처리 중 오류 발생:', error);
        }
    });

    // 타이머 모드 변경 이벤트 (컨트롤 페이지에서 사용)
    socket.on('timer_mode_change', async (data) => {
        try {
            const { matchId, newMode } = data;
            console.log(`타이머 모드 변경 요청: matchId=${matchId}, newMode=${newMode}`);
            
            // DB에 타이머 모드 저장
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = match.match_data || {};
                matchData.timer_mode = newMode;
                matchData.timer_mode_updated_at = Date.now();
                await match.update({ match_data: matchData });
                console.log(`타이머 모드 저장 완료: matchId=${matchId}, mode=${newMode}`);
            }
            
            // 모든 클라이언트에게 모드 변경 알림
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('timer_mode_updated', {
                matchId: matchId,
                currentMode: newMode
            });
            
            console.log(`타이머 모드 변경 완료: matchId=${matchId}, mode=${newMode}`);
            
        } catch (error) {
            console.error('타이머 모드 변경 중 오류 발생:', error);
        }
    });

    // 타이머 모드 요청 이벤트 (페이지 로드 시 사용)
    socket.on('request_timer_mode', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 모드 요청: matchId=${matchId}`);
            
            // DB에서 저장된 타이머 모드 조회
            const match = await Match.findByPk(matchId);
            let currentMode = 'legacy-timer'; // 기본값 (기존 타이머 시스템)
            
            if (match && match.match_data && match.match_data.timer_mode) {
                currentMode = match.match_data.timer_mode;
                console.log(`저장된 타이머 모드 발견: matchId=${matchId}, mode=${currentMode}`);
            } else {
                console.log(`기본 타이머 모드 사용: matchId=${matchId}, mode=${currentMode} (DB에 저장하지 않음)`);
            }
            
            socket.emit('timer_mode_response', {
                matchId: matchId,
                currentMode: currentMode
            });
            
            console.log(`타이머 모드 응답: matchId=${matchId}, mode=${currentMode}`);
            
        } catch (error) {
            console.error('타이머 모드 요청 처리 중 오류 발생:', error);
        }
    });

    // 타이머 v2 모드 요청 이벤트 (기존 호환성 유지)
    socket.on('timer_v2_request_mode', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 v2 모드 요청: matchId=${matchId}`);
            
            socket.emit('timer_v2_mode_updated', {
                matchId: matchId,
                newMode: 'hybrid'
            });
            
            console.log(`타이머 v2 모드 응답: matchId=${matchId}, mode=hybrid`);
            
        } catch (error) {
            console.error('타이머 v2 모드 요청 처리 중 오류 발생:', error);
        }
    });
    
    console.log('단순화된 타이머 시스템 v2 이벤트 설정 완료:', socket.id);
};

module.exports = timerV2SimpleEvents;
