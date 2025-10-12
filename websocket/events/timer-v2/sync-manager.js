// SportsCoder 타이머 동기화 관리 시스템 v2
// 서버 중심 타이머와 하이브리드 타이머 간의 동기화 관리

class TimerSyncManager {
    constructor() {
        // 동기화 관리 데이터
        this.timerSyncData = new Map();
        this.syncInterval = 1000; // 1초마다 동기화
        this.maxSyncDelay = 5000; // 최대 동기화 지연 시간 (5초)
        this.syncRetryCount = 3; // 동기화 재시도 횟수
        
        console.log('타이머 동기화 관리 시스템 초기화 완료');
    }
    
    /**
     * 타이머 동기화 관리
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} data - 이벤트 데이터
     * @param {Object} io - Socket.IO 인스턴스
     */
    async handleSyncManagement(socket, data, io) {
        const { matchId, action } = data;
        
        console.log(`타이머 동기화 관리 요청: matchId=${matchId}, action=${action}`);
        
        try {
            switch (action) {
                case 'start_sync':
                    await this.startSync(matchId, socket, io);
                    break;
                case 'stop_sync':
                    await this.stopSync(matchId);
                    break;
                case 'force_sync':
                    await this.forceSync(matchId, socket, io);
                    break;
                case 'get_sync_status':
                    await this.getSyncStatus(matchId, socket);
                    break;
                default:
                    socket.emit('timer_v2_sync_error', {
                        matchId: matchId,
                        error: `지원하지 않는 동기화 액션입니다: ${action}`
                    });
            }
        } catch (error) {
            console.error('타이머 동기화 관리 중 오류 발생:', error);
            socket.emit('timer_v2_sync_error', {
                matchId: matchId,
                error: `동기화 관리 중 오류 발생: ${error.message}`
            });
        }
    }
    
    /**
     * 동기화 시작
     * @param {string} matchId - 경기 ID
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} io - Socket.IO 인스턴스
     */
    async startSync(matchId, socket, io) {
        console.log(`타이머 동기화 시작: matchId=${matchId}`);
        
        const syncData = {
            matchId: matchId,
            isActive: true,
            startTime: Date.now(),
            lastSyncTime: Date.now(),
            syncCount: 0,
            errorCount: 0,
            retryCount: 0
        };
        
        this.timerSyncData.set(matchId, syncData);
        
        // 동기화 간격 설정
        const syncInterval = setInterval(async () => {
            try {
                await this.performSync(matchId, socket, io);
            } catch (error) {
                console.error(`타이머 동기화 실행 중 오류 발생: matchId=${matchId}`, error);
            }
        }, this.syncInterval);
        
        // 동기화 간격 ID 저장
        syncData.syncIntervalId = syncInterval;
        this.timerSyncData.set(matchId, syncData);
        
        socket.emit('timer_v2_sync_started', {
            matchId: matchId,
            syncInterval: this.syncInterval,
            message: '타이머 동기화가 시작되었습니다.'
        });
        
        console.log(`타이머 동기화 시작 완료: matchId=${matchId}`);
    }
    
    /**
     * 동기화 정지
     * @param {string} matchId - 경기 ID
     */
    async stopSync(matchId) {
        console.log(`타이머 동기화 정지: matchId=${matchId}`);
        
        const syncData = this.timerSyncData.get(matchId);
        if (syncData && syncData.syncIntervalId) {
            clearInterval(syncData.syncIntervalId);
            syncData.isActive = false;
            syncData.stopTime = Date.now();
            
            this.timerSyncData.set(matchId, syncData);
            
            console.log(`타이머 동기화 정지 완료: matchId=${matchId}`);
        }
    }
    
    /**
     * 강제 동기화
     * @param {string} matchId - 경기 ID
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} io - Socket.IO 인스턴스
     */
    async forceSync(matchId, socket, io) {
        console.log(`타이머 강제 동기화: matchId=${matchId}`);
        
        try {
            await this.performSync(matchId, socket, io);
            
            socket.emit('timer_v2_sync_forced', {
                matchId: matchId,
                message: '타이머 강제 동기화가 완료되었습니다.'
            });
            
            console.log(`타이머 강제 동기화 완료: matchId=${matchId}`);
        } catch (error) {
            console.error(`타이머 강제 동기화 실패: matchId=${matchId}`, error);
            socket.emit('timer_v2_sync_error', {
                matchId: matchId,
                error: `강제 동기화 실패: ${error.message}`
            });
        }
    }
    
    /**
     * 동기화 상태 가져오기
     * @param {string} matchId - 경기 ID
     * @param {Object} socket - Socket.IO 소켓
     */
    async getSyncStatus(matchId, socket) {
        console.log(`타이머 동기화 상태 요청: matchId=${matchId}`);
        
        const syncData = this.timerSyncData.get(matchId);
        if (syncData) {
            const currentTime = Date.now();
            const lastSyncDelay = currentTime - syncData.lastSyncTime;
            
            socket.emit('timer_v2_sync_status', {
                matchId: matchId,
                isActive: syncData.isActive,
                startTime: syncData.startTime,
                lastSyncTime: syncData.lastSyncTime,
                syncCount: syncData.syncCount,
                errorCount: syncData.errorCount,
                retryCount: syncData.retryCount,
                lastSyncDelay: lastSyncDelay,
                syncInterval: this.syncInterval
            });
        } else {
            socket.emit('timer_v2_sync_status', {
                matchId: matchId,
                isActive: false,
                message: '동기화가 시작되지 않았습니다.'
            });
        }
    }
    
    /**
     * 동기화 실행
     * @param {string} matchId - 경기 ID
     * @param {Object} socket - Socket.IO 소켓
     * @param {Object} io - Socket.IO 인스턴스
     */
    async performSync(matchId, socket, io) {
        const syncData = this.timerSyncData.get(matchId);
        if (!syncData || !syncData.isActive) {
            return;
        }
        
        try {
            const currentTime = Date.now();
            const lastSyncDelay = currentTime - syncData.lastSyncTime;
            
            // 동기화 지연 시간 확인
            if (lastSyncDelay > this.maxSyncDelay) {
                console.warn(`타이머 동기화 지연 감지: matchId=${matchId}, delay=${lastSyncDelay}ms`);
                
                // 재시도 횟수 증가
                syncData.retryCount++;
                if (syncData.retryCount >= this.syncRetryCount) {
                    console.error(`타이머 동기화 재시도 한계 초과: matchId=${matchId}`);
                    syncData.errorCount++;
                    syncData.retryCount = 0;
                }
            } else {
                // 정상 동기화
                syncData.syncCount++;
                syncData.retryCount = 0;
            }
            
            // 동기화 시간 업데이트
            syncData.lastSyncTime = currentTime;
            this.timerSyncData.set(matchId, syncData);
            
            // 동기화 이벤트 전송
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('timer_v2_sync_update', {
                matchId: matchId,
                syncTime: currentTime,
                syncCount: syncData.syncCount,
                errorCount: syncData.errorCount,
                lastSyncDelay: lastSyncDelay
            });
            
            console.log(`타이머 동기화 실행 완료: matchId=${matchId}, syncCount=${syncData.syncCount}`);
            
        } catch (error) {
            console.error(`타이머 동기화 실행 중 오류 발생: matchId=${matchId}`, error);
            
            syncData.errorCount++;
            this.timerSyncData.set(matchId, syncData);
            
            // 오류 이벤트 전송
            socket.emit('timer_v2_sync_error', {
                matchId: matchId,
                error: `동기화 실행 중 오류 발생: ${error.message}`,
                errorCount: syncData.errorCount
            });
        }
    }
    
    /**
     * 동기화 통계 가져오기
     * @param {string} matchId - 경기 ID
     * @returns {Object} 동기화 통계
     */
    getSyncStatistics(matchId) {
        const syncData = this.timerSyncData.get(matchId);
        if (!syncData) {
            return null;
        }
        
        const currentTime = Date.now();
        const totalTime = currentTime - syncData.startTime;
        const syncRate = syncData.syncCount / (totalTime / 1000); // 초당 동기화 횟수
        const errorRate = syncData.errorCount / (syncData.syncCount + syncData.errorCount); // 오류율
        
        return {
            matchId: matchId,
            isActive: syncData.isActive,
            startTime: syncData.startTime,
            totalTime: totalTime,
            syncCount: syncData.syncCount,
            errorCount: syncData.errorCount,
            retryCount: syncData.retryCount,
            syncRate: syncRate,
            errorRate: errorRate,
            lastSyncTime: syncData.lastSyncTime
        };
    }
    
    /**
     * 모든 경기의 동기화 통계 가져오기
     * @returns {Object} 전체 동기화 통계
     */
    getAllSyncStatistics() {
        const statistics = {
            totalMatches: this.timerSyncData.size,
            activeMatches: 0,
            totalSyncCount: 0,
            totalErrorCount: 0,
            averageSyncRate: 0,
            averageErrorRate: 0
        };
        
        let totalSyncRate = 0;
        let totalErrorRate = 0;
        
        for (const [matchId, syncData] of this.timerSyncData.entries()) {
            if (syncData.isActive) {
                statistics.activeMatches++;
            }
            
            statistics.totalSyncCount += syncData.syncCount;
            statistics.totalErrorCount += syncData.errorCount;
            
            const currentTime = Date.now();
            const totalTime = currentTime - syncData.startTime;
            const syncRate = syncData.syncCount / (totalTime / 1000);
            const errorRate = syncData.errorCount / (syncData.syncCount + syncData.errorCount);
            
            totalSyncRate += syncRate;
            totalErrorRate += errorRate;
        }
        
        if (statistics.totalMatches > 0) {
            statistics.averageSyncRate = totalSyncRate / statistics.totalMatches;
            statistics.averageErrorRate = totalErrorRate / statistics.totalMatches;
        }
        
        return statistics;
    }
    
    /**
     * 동기화 정리
     * @param {string} matchId - 경기 ID
     */
    cleanupSync(matchId) {
        console.log(`타이머 동기화 정리: matchId=${matchId}`);
        
        const syncData = this.timerSyncData.get(matchId);
        if (syncData && syncData.syncIntervalId) {
            clearInterval(syncData.syncIntervalId);
            this.timerSyncData.delete(matchId);
            
            console.log(`타이머 동기화 정리 완료: matchId=${matchId}`);
        }
    }
}

module.exports = TimerSyncManager;
