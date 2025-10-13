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

            // DB에 타이머 상태 저장 (중요한 액션만)
            if (action === 'stop' || action === 'pause' || action === 'reset' || action === 'set') {
                try {
                    const match = await Match.findByPk(matchId);
                    if (match) {
                        const matchData = match.match_data || {};
                        matchData.server_timer_startTime = timerData.startTime;
                        matchData.server_timer_pausedTime = timerData.pausedTime;
                        matchData.server_timer_isRunning = timerData.isRunning;
                        matchData.server_timer_lastUpdateTime = timerData.lastUpdateTime;
                        await match.update({ match_data: matchData });
                        console.log(`서버 타이머 DB 저장 완료: matchId=${matchId}, action=${action}`);
                    }
                } catch (error) {
                    console.error('서버 타이머 DB 저장 실패:', error);
                }
            } else {
                console.log(`서버 타이머 DB 저장 생략: matchId=${matchId}, action=${action} (start 액션은 메모리만 사용)`);
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

    // 서버 타이머 상태 요청 이벤트 (데이터베이스 복원 포함)
    socket.on('request_server_timer_state', async (data) => {
        try {
            const { matchId } = data;
            console.log(`서버 타이머 상태 요청: matchId=${matchId}`);

            // 메모리에서 타이머 상태 확인
            let timerData = global.timerV2States.get(matchId);
            
            if (!timerData) {
                // 데이터베이스에서 타이머 상태 복원 시도
                try {
                    const match = await Match.findByPk(matchId);
                    if (match && match.match_data) {
                        const matchData = match.match_data;
                        if (matchData.server_timer_startTime !== undefined && matchData.server_timer_pausedTime !== undefined) {
                            const isRunning = matchData.server_timer_isRunning || false;
                            const pausedTime = matchData.server_timer_pausedTime || 0;
                            const startTime = matchData.server_timer_startTime || null;
                            
                            // 타이머 상태 복원
                            timerData = {
                                isRunning: isRunning,
                                startTime: startTime,
                                pausedTime: pausedTime,
                                lastUpdateTime: Date.now()
                            };
                            
                            global.timerV2States.set(matchId, timerData);
                            console.log(`데이터베이스에서 타이머 상태 복원: matchId=${matchId}, isRunning=${isRunning}, pausedTime=${pausedTime}`);
                        }
                    }
                } catch (error) {
                    console.error(`데이터베이스에서 타이머 상태 복원 실패: ${error.message}`);
                }
                
                // 복원 실패 시 기본 상태로 초기화
                if (!timerData) {
                    timerData = {
                        startTime: null,
                        pausedTime: 0,
                        isRunning: false,
                        lastUpdateTime: Date.now()
                    };
                    global.timerV2States.set(matchId, timerData);
                    console.log(`서버 타이머 기본 상태 초기화: matchId=${matchId}`);
                }
            }

            // 현재 시간 계산
            let currentSeconds = timerData.pausedTime;
            if (timerData.isRunning && timerData.startTime && timerData.startTime > 0) {
                const elapsedTime = Math.round((Date.now() - timerData.startTime) / 1000);
                currentSeconds = timerData.pausedTime + elapsedTime;
                console.log(`서버 타이머 시간 계산: pausedTime=${timerData.pausedTime}, elapsedTime=${elapsedTime}, currentSeconds=${currentSeconds}`);
            } else if (timerData.isRunning && (!timerData.startTime || timerData.startTime === 0)) {
                // 타이머가 실행 중이지만 startTime이 없거나 0인 경우
                console.log(`서버 타이머 실행 중이지만 startTime이 없음: isRunning=${timerData.isRunning}, startTime=${timerData.startTime}`);
                currentSeconds = timerData.pausedTime;
            }
            
            // 컨트롤 패널에 즉시 응답
            socket.emit('server_timer_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime
            });
            
            // 오버레이 페이지에도 전송 (최종 아웃풋)
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('server_timer_update', {
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

    // 주기적 브로드캐스트 제거 - 단순화된 서버 타이머 시스템
    // 타이머 상태는 컨트롤 패널에서만 변경되고, 오버레이 페이지는 이벤트 기반으로만 업데이트

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

    // 로컬 타이머 상태 저장 이벤트
    socket.on('save_local_timer_state', async (data) => {
        try {
            const { matchId, timerState } = data;
            console.log(`로컬 타이머 상태 저장 요청: matchId=${matchId}`);
            
            // Match 테이블의 match_data에 로컬 타이머 상태 저장
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = match.match_data || {};
                matchData.local_timer_currentSeconds = timerState.currentSeconds;
                matchData.local_timer_isRunning = timerState.isRunning;
                matchData.local_timer_startTime = timerState.startTime;
                matchData.local_timer_pausedTime = timerState.pausedTime;
                matchData.local_timer_lastSaveTime = timerState.lastSaveTime;
                
                await match.update({ match_data: matchData });
                console.log(`로컬 타이머 상태 DB 저장 완료: matchId=${matchId}`);
            }
        } catch (error) {
            console.error('로컬 타이머 상태 저장 실패:', error);
        }
    });

    // 로컬 타이머 상태 요청 이벤트
    socket.on('request_local_timer_state', async (data) => {
        try {
            const { matchId } = data;
            console.log(`로컬 타이머 상태 요청: matchId=${matchId}`);
            
            // Match 테이블에서 로컬 타이머 상태 복원
            const match = await Match.findByPk(matchId);
            if (match && match.match_data) {
                const matchData = match.match_data;
                if (matchData.local_timer_currentSeconds !== undefined) {
                    const localTimerState = {
                        currentSeconds: matchData.local_timer_currentSeconds || 0,
                        isRunning: matchData.local_timer_isRunning || false,
                        startTime: matchData.local_timer_startTime || null,
                        pausedTime: matchData.local_timer_pausedTime || 0,
                        lastSaveTime: matchData.local_timer_lastSaveTime || Date.now()
                    };
                    
                    // 실행 중이었다면 경과 시간 계산
                    if (localTimerState.isRunning && localTimerState.startTime) {
                        const elapsedTime = Math.floor((Date.now() - localTimerState.startTime) / 1000);
                        localTimerState.currentSeconds = localTimerState.pausedTime + elapsedTime;
                    }
                    
                    // 컨트롤 페이지에 응답
                    socket.emit('local_timer_state_restored', {
                        matchId: matchId,
                        timerState: localTimerState
                    });
                    
                    // 오버레이 페이지에도 전송
                    const roomName = `match_${matchId}`;
                    io.to(roomName).emit('local_timer_update', {
                        matchId: matchId,
                        currentSeconds: localTimerState.currentSeconds,
                        isRunning: localTimerState.isRunning,
                        startTime: localTimerState.startTime,
                        pausedTime: localTimerState.pausedTime
                    });
                    
                    console.log(`로컬 타이머 상태 복원 완료: matchId=${matchId}`, localTimerState);
                } else {
                    console.log(`로컬 타이머 상태 없음: matchId=${matchId}`);
                    // 상태가 없어도 오버레이 페이지에 기본 상태 전송
                    const roomName = `match_${matchId}`;
                    io.to(roomName).emit('local_timer_update', {
                        matchId: matchId,
                        currentSeconds: 0,
                        isRunning: false,
                        startTime: null,
                        pausedTime: 0
                    });
                }
            } else {
                // 경기 데이터가 없어도 오버레이 페이지에 기본 상태 전송
                const roomName = `match_${matchId}`;
                io.to(roomName).emit('local_timer_update', {
                    matchId: matchId,
                    currentSeconds: 0,
                    isRunning: false,
                    startTime: null,
                    pausedTime: 0
                });
            }
        } catch (error) {
            console.error('로컬 타이머 상태 요청 처리 중 오류 발생:', error);
        }
    });

    // 로컬 타이머 업데이트 이벤트 (컨트롤 페이지에서 오버레이 페이지로 전달)
    socket.on('local_timer_update', function(data) {
        try {
            const { matchId } = data;
            console.log(`🔔 로컬 타이머 업데이트 수신: matchId=${matchId}, isRunning=${data.isRunning}, currentSeconds=${data.currentSeconds}`);
            
            // 오버레이 페이지에 로컬 타이머 상태 전달
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('local_timer_update', data);
            
            console.log(`📡 로컬 타이머 업데이트 전달: matchId=${matchId}, isRunning=${data.isRunning}, currentSeconds=${data.currentSeconds}`);
        } catch (error) {
            console.error('로컬 타이머 업데이트 처리 중 오류 발생:', error);
        }
    });

    console.log('단순화된 서버 타이머 시스템 v2 이벤트 설정 완료:', socket.id);
};

module.exports = timerV2SimpleEvents;