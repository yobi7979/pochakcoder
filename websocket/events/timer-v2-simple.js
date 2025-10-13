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
                    console.log(`타이머 v2 설정: matchId=${matchId}, targetTime=${targetTime}, pausedTime=${timerData.pausedTime}`);
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
            
            // 타이머 시작 시 1초부터 시작하도록 조정
            if (currentSeconds === 0 && timerData.isRunning) {
                currentSeconds = 1;
                console.log(`타이머 시작 조정: 0초 -> 1초`);
            }

            // 타이머 모드 확인
            let timerMode = 'hybrid'; // 기본값
            try {
                const setting = await Settings.findOne({ where: { key: `timer_mode_${matchId}` } });
                if (setting) {
                    timerMode = setting.value;
                }
            } catch (error) {
                console.error('타이머 모드 조회 실패:', error);
            }

            // 모든 클라이언트에게 타이머 상태 전송
            io.to(roomName).emit('timer_v2_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime,
                mode: timerMode
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
            
            // 타이머 모드 확인
            let timerMode = 'hybrid'; // 기본값
            try {
                const setting = await Settings.findOne({ where: { key: `timer_mode_${matchId}` } });
                if (setting) {
                    timerMode = setting.value;
                }
            } catch (error) {
                console.error('타이머 모드 조회 실패:', error);
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
                    mode: timerMode
                });
            } else {
                socket.emit('timer_v2_state', {
                    matchId: matchId,
                    currentSeconds: 0,
                    isRunning: false,
                    startTime: 0,
                    pausedTime: 0,
                    mode: timerMode
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
            
            // Settings 테이블에 타이머 모드 저장
            const { Settings } = require('../../models');
            const settingKey = `timer_mode_${matchId}`;
            
            try {
                // 기존 설정 확인
                let setting = await Settings.findOne({ where: { key: settingKey } });
                
                if (setting) {
                    // 기존 설정 업데이트
                    await setting.update({ 
                        value: newMode,
                        updated_at: new Date()
                    });
                    console.log(`Settings 테이블 업데이트 성공: key=${settingKey}, value=${newMode}`);
                } else {
                    // 새 설정 생성
                    await Settings.create({
                        key: settingKey,
                        value: newMode,
                        description: `타이머 모드 설정 - 경기 ${matchId}`,
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    console.log(`Settings 테이블 생성 성공: key=${settingKey}, value=${newMode}`);
                }
                
                // 저장 후 확인
                const savedSetting = await Settings.findOne({ where: { key: settingKey } });
                if (savedSetting) {
                    console.log(`✅ Settings 테이블 저장 확인: key=${savedSetting.key}, value=${savedSetting.value}`);
                } else {
                    console.log(`❌ Settings 테이블 저장 확인 실패`);
                }
                
            } catch (settingsError) {
                console.error(`❌ Settings 테이블 저장 실패:`, settingsError.message);
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
            
            // Settings 테이블에서 타이머 모드 조회
            const { Settings } = require('../../models');
            const settingKey = `timer_mode_${matchId}`;
            let currentMode = null; // 저장된 모드가 없으면 null
            
            try {
                const setting = await Settings.findOne({ where: { key: settingKey } });
                
                if (setting) {
                    currentMode = setting.value;
                    console.log(`Settings 테이블에서 타이머 모드 발견: key=${settingKey}, value=${currentMode}`);
                } else {
                    console.log(`Settings 테이블에서 타이머 모드 없음: key=${settingKey} (사용자 선택 대기)`);
                }
                
            } catch (settingsError) {
                console.error(`Settings 테이블 조회 실패:`, settingsError.message);
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
