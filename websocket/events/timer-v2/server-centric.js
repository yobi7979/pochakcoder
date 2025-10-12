// SportsCoder 서버 중심 타이머 시스템 v2
// 기존 타이머 시스템과 완전히 독립적인 서버 중심 타이머 시스템

const { Match } = require('../../../models');

class ServerCentricTimer {
    constructor() {
        // 기존 시스템과 완전히 독립적인 데이터 저장
        this.serverCentricTimerData = new Map();
        this.pendingDbUpdates = new Map();
        this.isActive = false;
        this.syncInterval = 1000; // 1초마다 동기화
        this.dbBatchInterval = 5000; // 5초마다 배치 업데이트
        
        console.log('서버 중심 타이머 시스템 초기화 완료');
    }
    
    /**
     * 서버 중심 타이머 시작
     * @param {string} matchId - 경기 ID
     * @param {Object} options - 옵션
     */
    startTimer(matchId, options = {}) {
        console.log(`서버 중심 타이머 시작: matchId=${matchId}`);
        
        let timerData = this.serverCentricTimerData.get(matchId);
        
        if (!timerData) {
            // 새로운 타이머 데이터 생성
            timerData = {
                startTime: Date.now(),
                pausedTime: 0,
                isRunning: true,
                matchId: matchId,
                serverTime: Date.now(),
                lastSyncTime: Date.now()
            };
        } else {
            // 기존 타이머 데이터 업데이트
            if (timerData.isRunning) {
                console.log(`서버 중심 타이머가 이미 실행 중: matchId=${matchId}`);
                return;
            }
            
            timerData.startTime = Date.now();
            timerData.isRunning = true;
            timerData.serverTime = Date.now();
            timerData.lastSyncTime = Date.now();
        }
        
        this.serverCentricTimerData.set(matchId, timerData);
        
        // DB 업데이트 대기열에 추가
        this.pendingDbUpdates.set(matchId, {
            timer_v2_startTime: timerData.startTime,
            timer_v2_pausedTime: timerData.pausedTime,
            timer_v2_isRunning: true,
            timer_v2_mode: 'server-centric',
            lastUpdateTime: Date.now()
        });
        
        console.log(`서버 중심 타이머 시작 완료: matchId=${matchId}, startTime=${timerData.startTime}`);
    }
    
    /**
     * 서버 중심 타이머 정지
     * @param {string} matchId - 경기 ID
     * @param {number} clientTime - 클라이언트 시간 (선택사항)
     */
    stopTimer(matchId, clientTime = null) {
        console.log(`서버 중심 타이머 정지: matchId=${matchId}`);
        
        const timerData = this.serverCentricTimerData.get(matchId);
        if (timerData && timerData.isRunning) {
            // 서버 시간 기준으로 정지 시간 계산
            const currentTime = Date.now();
            const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
            timerData.pausedTime = elapsedTime;
            timerData.isRunning = false;
            timerData.serverTime = currentTime;
            timerData.lastSyncTime = currentTime;
            
            this.serverCentricTimerData.set(matchId, timerData);
            
            // DB 업데이트 대기열에 추가
            this.pendingDbUpdates.set(matchId, {
                timer_v2_startTime: timerData.startTime,
                timer_v2_pausedTime: timerData.pausedTime,
                timer_v2_isRunning: false,
                timer_v2_mode: 'server-centric',
                lastUpdateTime: Date.now()
            });
            
            console.log(`서버 중심 타이머 정지 완료: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
        }
    }
    
    /**
     * 서버 중심 타이머 리셋
     * @param {string} matchId - 경기 ID
     */
    resetTimer(matchId) {
        console.log(`서버 중심 타이머 리셋: matchId=${matchId}`);
        
        const timerData = {
            startTime: 0,
            pausedTime: 0,
            isRunning: false,
            matchId: matchId,
            serverTime: Date.now(),
            lastSyncTime: Date.now()
        };
        
        this.serverCentricTimerData.set(matchId, timerData);
        
        // DB 업데이트 대기열에 추가
        this.pendingDbUpdates.set(matchId, {
            timer_v2_startTime: 0,
            timer_v2_pausedTime: 0,
            timer_v2_isRunning: false,
            timer_v2_mode: 'server-centric',
            lastUpdateTime: Date.now()
        });
        
        console.log(`서버 중심 타이머 리셋 완료: matchId=${matchId}`);
    }
    
    /**
     * 서버 중심 타이머 설정
     * @param {string} matchId - 경기 ID
     * @param {number} minutes - 분
     * @param {number} seconds - 초
     */
    setTimer(matchId, minutes, seconds) {
        console.log(`서버 중심 타이머 설정: matchId=${matchId}, minutes=${minutes}, seconds=${seconds}`);
        
        const targetTime = (minutes * 60) + seconds;
        
        const timerData = {
            startTime: 0,
            pausedTime: targetTime,
            isRunning: false,
            matchId: matchId,
            serverTime: Date.now(),
            lastSyncTime: Date.now()
        };
        
        this.serverCentricTimerData.set(matchId, timerData);
        
        // DB 업데이트 대기열에 추가
        this.pendingDbUpdates.set(matchId, {
            timer_v2_startTime: 0,
            timer_v2_pausedTime: targetTime,
            timer_v2_isRunning: false,
            timer_v2_mode: 'server-centric',
            lastUpdateTime: Date.now()
        });
        
        console.log(`서버 중심 타이머 설정 완료: matchId=${matchId}, targetTime=${targetTime}`);
    }
    
    /**
     * 현재 시간 가져오기
     * @param {string} matchId - 경기 ID
     * @returns {number} 현재 시간 (초)
     */
    getCurrentTime(matchId) {
        const timerData = this.serverCentricTimerData.get(matchId);
        if (!timerData) {
            return 0;
        }
        
        if (timerData.isRunning) {
            const currentTime = Date.now();
            const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
            return timerData.pausedTime + elapsedTime;
        } else {
            return timerData.pausedTime;
        }
    }
    
    /**
     * 타이머 제어 이벤트 처리
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} data - 이벤트 데이터
     * @param {Object} io - Socket.IO 인스턴스
     */
    async handleControl(socket, data, io) {
        const { matchId, action, minutes, seconds, currentTime } = data;
        
        switch (action) {
            case 'start':
                this.startTimer(matchId);
                break;
            case 'stop':
            case 'pause':
                this.stopTimer(matchId, currentTime);
                break;
            case 'reset':
                this.resetTimer(matchId);
                break;
            case 'set':
                this.setTimer(matchId, minutes, seconds);
                break;
        }
        
        // WebSocket 이벤트 전송
        const roomName = `match_${matchId}`;
        const currentSeconds = this.getCurrentTime(matchId);
        
        io.to(roomName).emit('timer_v2_updated', {
            matchId: matchId,
            currentSeconds: currentSeconds,
            isRunning: this.serverCentricTimerData.get(matchId)?.isRunning || false,
            startTime: this.serverCentricTimerData.get(matchId)?.startTime || 0,
            pausedTime: this.serverCentricTimerData.get(matchId)?.pausedTime || 0,
            mode: 'server-centric'
        });
        
        // DB 업데이트
        await this.updateDatabase(matchId);
    }
    
    /**
     * 타이머 동기화 이벤트 처리
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} data - 이벤트 데이터
     * @param {Object} io - Socket.IO 인스턴스
     */
    async handleSync(socket, data, io) {
        const { matchId, currentSeconds, isRunning, startTime, pausedTime } = data;
        
        const timerData = {
            startTime: startTime || Date.now(),
            pausedTime: pausedTime || currentSeconds || 0,
            isRunning: isRunning || false,
            matchId: matchId,
            serverTime: Date.now(),
            lastSyncTime: Date.now()
        };
        
        this.serverCentricTimerData.set(matchId, timerData);
        
        // DB 업데이트
        await this.updateDatabase(matchId);
        
        // 동기화된 상태 전송
        const roomName = `match_${matchId}`;
        io.to(roomName).emit('timer_v2_state', {
            matchId: matchId,
            currentSeconds: timerData.pausedTime,
            isRunning: timerData.isRunning,
            startTime: timerData.startTime,
            pausedTime: timerData.pausedTime,
            mode: 'server-centric'
        });
    }
    
    /**
     * 타이머 상태 요청 이벤트 처리
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} data - 이벤트 데이터
     * @param {Object} io - Socket.IO 인스턴스
     */
    async handleStateRequest(socket, data, io) {
        const { matchId } = data;
        
        const timerData = this.serverCentricTimerData.get(matchId);
        if (timerData) {
            const currentSeconds = this.getCurrentTime(matchId);
            
            socket.emit('timer_v2_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime,
                mode: 'server-centric'
            });
        } else {
            socket.emit('timer_v2_state', {
                matchId: matchId,
                currentSeconds: 0,
                isRunning: false,
                startTime: 0,
                pausedTime: 0,
                mode: 'server-centric'
            });
        }
    }
    
    /**
     * 데이터베이스 업데이트
     * @param {string} matchId - 경기 ID
     */
    async updateDatabase(matchId) {
        try {
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = { ...match.match_data } || {};
                const timerData = this.serverCentricTimerData.get(matchId);
                
                if (timerData) {
                    matchData.timer_v2_startTime = timerData.startTime;
                    matchData.timer_v2_pausedTime = timerData.pausedTime;
                    matchData.timer_v2_isRunning = timerData.isRunning;
                    matchData.timer_v2_mode = 'server-centric';
                    matchData.timer_v2_lastUpdateTime = Date.now();
                }
                
                await match.update({ match_data: matchData });
                console.log(`서버 중심 타이머 DB 업데이트 완료: matchId=${matchId}`);
            }
        } catch (error) {
            console.error('서버 중심 타이머 DB 업데이트 실패:', error);
        }
    }
}

module.exports = ServerCentricTimer;
