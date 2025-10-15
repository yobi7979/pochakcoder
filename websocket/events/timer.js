// SportsCoder 서버 중심 타이머 시스템
// 서버가 유일한 시간 기준이 되는 단순한 타이머 시스템

const { Match } = require('../../models');

// 전역 타이머 상태 관리 (메모리)
if (!global.serverTimerStates) global.serverTimerStates = new Map();

/**
 * 서버 중심 타이머 클래스
 */
class ServerCentricTimer {
    constructor() {
        this.timerStates = global.serverTimerStates;
    }
    
    // 타이머 시작 (서버 시간 기준)
    startTimer(matchId, io) {
        const currentState = this.timerStates.get(matchId);
        
        // 이미 실행 중인 타이머인지 확인
        if (currentState && currentState.isRunning) {
            console.log(`서버 타이머 이미 실행 중: matchId=${matchId}, 무시됨`);
            return; // 이미 실행 중이면 무시
        }
        
        const serverTime = Date.now();
        
        // 기존 pausedTime을 유지하거나 0으로 초기화
        const pausedTime = currentState ? currentState.pausedTime : 0;
        
        this.timerStates.set(matchId, {
            startTime: serverTime,
            pausedTime: pausedTime,
            isRunning: true,
            lastUpdate: serverTime
        });
        
        console.log(`서버 타이머 시작: matchId=${matchId}, serverTime=${serverTime}, pausedTime=${pausedTime}`);
        this.broadcastTimerState(matchId, io);
        this.saveToDatabase(matchId);
    }
    
    // 타이머 정지
    stopTimer(matchId, io) {
        const state = this.timerStates.get(matchId);
        if (state && state.isRunning) {
            const serverTime = Date.now();
            const elapsed = Math.floor((serverTime - state.startTime) / 1000);
            state.pausedTime += elapsed;
            state.isRunning = false;
            state.lastUpdate = serverTime;
            
            console.log(`서버 타이머 정지: matchId=${matchId}, pausedTime=${state.pausedTime}`);
            this.broadcastTimerState(matchId, io);
            this.saveToDatabase(matchId);
        }
    }
    
    // 타이머 리셋
    resetTimer(matchId, io) {
        const serverTime = Date.now();
        this.timerStates.set(matchId, {
            startTime: serverTime,
            pausedTime: 0,
            isRunning: false,
            lastUpdate: serverTime
        });
        
        console.log(`서버 타이머 리셋: matchId=${matchId}`);
        this.broadcastTimerState(matchId, io);
        this.saveToDatabase(matchId);
    }
    
    // 타이머 설정
    setTimer(matchId, minutes, seconds, io) {
        const serverTime = Date.now();
        const targetTime = minutes * 60 + seconds;
        
        this.timerStates.set(matchId, {
            startTime: serverTime,
            pausedTime: targetTime,
            isRunning: false,
            lastUpdate: serverTime
        });
        
        console.log(`서버 타이머 설정: matchId=${matchId}, targetTime=${targetTime}`);
        this.broadcastTimerState(matchId, io);
        this.saveToDatabase(matchId);
    }
    
    // 현재 시간 계산 (서버 시간 기준)
    getCurrentTime(matchId) {
        const state = this.timerStates.get(matchId);
        if (!state) return 0;
        
        if (state.isRunning) {
            const serverTime = Date.now();
            const elapsed = Math.floor((serverTime - state.startTime) / 1000);
            return state.pausedTime + elapsed;
        }
        
        return state.pausedTime;
    }
    
    // 모든 클라이언트에 상태 전송
    broadcastTimerState(matchId, io) {
        const currentTime = this.getCurrentTime(matchId);
        const state = this.timerStates.get(matchId);
        
        if (!state || !io) return;
        
        const roomName = `match_${matchId}`;
        io.to(roomName).emit('timer_state', {
            matchId: matchId,
            currentSeconds: currentTime,
            isRunning: state.isRunning,
            serverTime: Date.now(),
            pausedTime: state.pausedTime,
            startTime: state.startTime
        });
        
        console.log(`서버 타이머 상태 전송: matchId=${matchId}, currentSeconds=${currentTime}, isRunning=${state.isRunning}`);
    }
    
    // 데이터베이스에 저장
    async saveToDatabase(matchId) {
        try {
            const match = await Match.findByPk(matchId);
            if (match) {
                const state = this.timerStates.get(matchId);
                const matchData = { ...match.match_data } || {};
                
                matchData.timer_startTime = state.startTime;
                matchData.timer_pausedTime = state.pausedTime;
                matchData.timer_isRunning = state.isRunning;
                matchData.timer_lastUpdate = state.lastUpdate;
                
                await match.update({ match_data: matchData });
                console.log(`서버 타이머 DB 저장 완료: matchId=${matchId}`);
            }
        } catch (error) {
            console.error('서버 타이머 DB 저장 오류:', error);
        }
    }
    
    // 데이터베이스에서 복원
    async restoreFromDatabase(matchId) {
        try {
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = match.match_data || {};
                
                if (matchData.timer_startTime && matchData.timer_pausedTime !== undefined) {
                    const state = {
                        startTime: matchData.timer_startTime,
                        pausedTime: matchData.timer_pausedTime,
                        isRunning: matchData.timer_isRunning || false,
                        lastUpdate: matchData.timer_lastUpdate || Date.now()
                    };
                    
                    this.timerStates.set(matchId, state);
                    console.log(`서버 타이머 DB 복원 완료: matchId=${matchId}`);
                    return state;
                }
            }
        } catch (error) {
            console.error('서버 타이머 DB 복원 오류:', error);
        }
        
        return null;
    }
}

// 전역 타이머 인스턴스
const serverTimer = new ServerCentricTimer();

/**
 * 서버 중심 타이머 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const timerEvents = (socket, io) => {
    console.log('서버 중심 타이머 이벤트 설정 시작:', socket.id);

    // 타이머 제어 이벤트 (클라이언트 → 서버)
    socket.on('timer_control', async (data) => {
        try {
            const { matchId, action, timeValue } = data;
            console.log(`타이머 제어 요청: matchId=${matchId}, action=${action}`);
            
            switch (action) {
                case 'start':
                    serverTimer.startTimer(matchId, io);
                    break;
                case 'stop':
                    serverTimer.stopTimer(matchId, io);
                    break;
                case 'reset':
                    serverTimer.resetTimer(matchId, io);
                    break;
                case 'set':
                    if (timeValue && timeValue.minutes !== undefined && timeValue.seconds !== undefined) {
                        serverTimer.setTimer(matchId, timeValue.minutes, timeValue.seconds, io);
                    }
                    break;
                default:
                    console.log(`알 수 없는 타이머 액션: ${action}`);
            }
            
        } catch (error) {
            console.error('타이머 제어 처리 중 오류 발생:', error);
        }
    });

    // 타이머 상태 요청 이벤트 (클라이언트 → 서버)
    socket.on('request_timer_state', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 상태 요청: matchId=${matchId}`);
            
            // 메모리에서 타이머 상태 확인
            let state = global.serverTimerStates.get(matchId);
            
            if (!state) {
                // 메모리에 없으면 DB에서 복원
                state = await serverTimer.restoreFromDatabase(matchId);
            }
            
            if (state) {
                const currentTime = serverTimer.getCurrentTime(matchId);
                
                socket.emit('timer_state', {
                    matchId: matchId,
                    currentSeconds: currentTime,
                    isRunning: state.isRunning,
                    serverTime: Date.now()
                });
                
                console.log(`타이머 상태 응답 전송: matchId=${matchId}, currentSeconds=${currentTime}, isRunning=${state.isRunning}`);
            } else {
                // 타이머 상태가 없으면 초기 상태 전송
                socket.emit('timer_state', {
                    matchId: matchId,
                    currentSeconds: 0,
                    isRunning: false,
                    serverTime: Date.now()
                });
                
                console.log(`타이머 초기 상태 전송: matchId=${matchId}`);
            }
            
        } catch (error) {
            console.error('타이머 상태 요청 처리 중 오류 발생:', error);
        }
    });

    // 타이머 동기화 이벤트 (클라이언트 → 서버) - 새로고침 시 사용
    socket.on('timer_sync', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 동기화 요청: matchId=${matchId}`);
            
            // 서버 상태를 클라이언트에 전송
            const currentTime = serverTimer.getCurrentTime(matchId);
            const state = global.serverTimerStates.get(matchId);
            
            socket.emit('timer_state', {
                matchId: matchId,
                currentSeconds: currentTime,
                isRunning: state ? state.isRunning : false,
                serverTime: Date.now()
            });
            
            console.log(`타이머 동기화 완료: matchId=${matchId}, currentSeconds=${currentTime}`);
            
        } catch (error) {
            console.error('타이머 동기화 처리 중 오류 발생:', error);
        }
    });

    // 타이머 업데이트 이벤트 (서버 → 클라이언트) - 주기적 업데이트
    socket.on('request_timer_update', async (data) => {
        try {
            const { matchId } = data;
            console.log(`타이머 업데이트 요청: matchId=${matchId}`);
            
            const currentTime = serverTimer.getCurrentTime(matchId);
            const state = global.serverTimerStates.get(matchId);
            
            if (state) {
                socket.emit('timer_update', {
                    matchId: matchId,
                    currentSeconds: currentTime,
                    isRunning: state.isRunning,
                    serverTime: Date.now()
                });
                
                console.log(`타이머 업데이트 전송: matchId=${matchId}, currentSeconds=${currentTime}`);
            }
            
        } catch (error) {
            console.error('타이머 업데이트 처리 중 오류 발생:', error);
        }
    });

    console.log('서버 중심 타이머 이벤트 설정 완료:', socket.id);
};

module.exports = timerEvents;