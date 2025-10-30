/**
 * 하이브리드 타이머 시스템
 * 서버 중심 타이머 + 로컬 백업 타이머
 * 서버 연결 끊김 시 자동으로 로컬 타이머로 전환
 * 서버 재연결 시 원래 상태로 복원
 */

class HybridTimerSystem {
    constructor(options = {}) {
        this.matchId = options.matchId;
        this.socket = options.socket;
        this.onTimerUpdate = options.onTimerUpdate || (() => {});
        this.onServerDisconnect = options.onServerDisconnect || (() => {});
        this.onServerReconnect = options.onServerReconnect || (() => {});
        
        // 타이머 상태 관리
        this.timerState = {
            // 서버 상태
            serverConnected: false,
            serverStateReceived: false,
            currentSeconds: 0,
            isRunning: false,
            startTime: null,
            pausedTime: 0,
            lastServerTime: 0,
            lastUpdateTime: 0,
            
            // 로컬 백업 상태
            localIsRunning: false,
            localStartTime: null,
            localPausedTime: 0,
            serverDisconnectTime: null,
            
            // 타이머 인터벌
            localTimerInterval: null
        };
        
        this.init();
    }
    
    /**
     * 하이브리드 타이머 시스템 초기화
     */
    init() {
        console.log('🔧 하이브리드 타이머 시스템 초기화');
        this.setupSocketEvents();
        this.setupServerEvents();
    }
    
    /**
     * 소켓 이벤트 설정
     */
    setupSocketEvents() {
        // 서버 연결 시
        this.socket.on('connect', () => {
            console.log('🔌 서버 연결됨 - 하이브리드 타이머 활성화');
            this.timerState.serverConnected = true;
            
            // 서버 재연결 시 로컬 타이머를 서버 상태로 동기화
            if (this.timerState.localIsRunning && this.timerState.serverDisconnectTime) {
                const disconnectDuration = Math.floor((Date.now() - this.timerState.serverDisconnectTime) / 1000);
                this.timerState.localPausedTime += disconnectDuration;
                console.log(`🔄 서버 재연결 - 로컬 타이머 동기화: ${disconnectDuration}초 추가`);
            }
            
            this.onServerReconnect();
        });
        
        // 서버 연결 끊김 시
        this.socket.on('disconnect', () => {
            console.log('🔌 서버 연결 끊김 - 로컬 타이머로 전환');
            this.timerState.serverConnected = false;
            this.timerState.serverDisconnectTime = Date.now();
            
            // 서버 연결 끊김 시 로컬 타이머로 전환
            if (this.timerState.isRunning) {
                this.timerState.localIsRunning = true;
                this.timerState.localStartTime = Date.now();
                this.timerState.localPausedTime = this.timerState.currentSeconds;
                console.log(`🔄 로컬 타이머 시작: ${this.timerState.localPausedTime}초부터 계속`);
                this.startLocalTimer();
            }
            
            this.onServerDisconnect();
        });
        
        // 서버 타이머 상태 수신
        this.socket.on('timer_state', (data) => {
            this.handleServerTimerState(data);
        });
    }
    
    /**
     * 서버 이벤트 설정 (서버 재시작 감지)
     */
    setupServerEvents() {
        // 주기적으로 서버 상태 확인
        setInterval(() => {
            this.checkServerStatus();
        }, 5000); // 5초마다 확인
    }
    
    /**
     * 서버 상태 확인
     */
    checkServerStatus() {
        if (!this.timerState.serverConnected && this.timerState.isRunning && !this.timerState.localIsRunning) {
            console.log('🔄 서버 연결 끊김 감지 - 로컬 타이머로 전환');
            this.timerState.localIsRunning = true;
            this.timerState.localStartTime = Date.now();
            this.timerState.localPausedTime = this.timerState.currentSeconds;
            this.startLocalTimer();
        }
    }
    
    /**
     * 서버 타이머 상태 처리
     */
    handleServerTimerState(data) {
        console.log('=== 하이브리드 타이머 상태 수신 ===');
        console.log('수신된 데이터:', data);
        
        if (data.matchId === this.matchId) {
            // 서버 상태 수신 플래그 설정
            this.timerState.serverStateReceived = true;
            this.timerState.serverConnected = true;
            
            // 서버에서 전송된 정확한 시간 사용
            this.timerState.currentSeconds = Math.max(0, data.currentSeconds || 0);
            this.timerState.isRunning = data.isRunning || false;
            this.timerState.startTime = data.startTime || null;
            this.timerState.pausedTime = data.pausedTime || 0;
            this.timerState.lastServerTime = data.serverTime || Date.now();

            // 서버가 실행 중인데 startTime이 비어있으면 currentSeconds로 역산하여 설정
            if (this.timerState.isRunning && !this.timerState.startTime) {
                this.timerState.startTime = Date.now() - (this.timerState.currentSeconds * 1000);
                console.log('하이브리드 startTime 보정 설정:', this.timerState.startTime);
            }
            
            // 로컬 백업 타이머 상태 초기화 (서버 연결 시)
            if (this.timerState.localIsRunning) {
                console.log('🔄 서버 재연결 - 로컬 타이머 상태 초기화');
                this.timerState.localIsRunning = false;
                this.timerState.localStartTime = null;
                this.timerState.localPausedTime = 0;
                this.stopLocalTimer();
            }
            
            console.log('하이브리드 타이머 상태 업데이트:', {
                currentSeconds: this.timerState.currentSeconds,
                isRunning: this.timerState.isRunning,
                serverConnected: this.timerState.serverConnected,
                localIsRunning: this.timerState.localIsRunning,
                startTime: this.timerState.startTime,
                pausedTime: this.timerState.pausedTime
            });
            
            // 타이머 표시 업데이트
            this.onTimerUpdate(this.timerState.currentSeconds, this.timerState.isRunning);

            // 서버에서 실행 중이면 즉시 로컬 갱신 루프 시작 (서버 연결 상태에서도 1초 주기 갱신)
            if (this.timerState.isRunning) {
                this.startLocalTimer();
            } else {
                this.stopLocalTimer();
            }
        }
    }
    
    /**
     * 로컬 타이머 시작
     */
    startLocalTimer() {
        console.log('=== 하이브리드 로컬 타이머 시작 함수 호출 ===');
        console.log('현재 타이머 상태:', {
            isRunning: this.timerState.isRunning,
            serverConnected: this.timerState.serverConnected,
            localIsRunning: this.timerState.localIsRunning,
            startTime: this.timerState.startTime,
            pausedTime: this.timerState.pausedTime,
            currentSeconds: this.timerState.currentSeconds
        });
        
        if (this.timerState.localTimerInterval) {
            clearInterval(this.timerState.localTimerInterval);
            this.timerState.localTimerInterval = null;
        }
        
        // 서버 연결 시: 서버 상태 기반 타이머 (초 경계 정렬로 2초 점프 방지)
        if (this.timerState.serverConnected && this.timerState.isRunning) {
            const scheduleTick = () => {
                if (!this.timerState.isRunning || !this.timerState.startTime) return;
                const now = Date.now();
                const elapsed = Math.floor((now - this.timerState.startTime) / 1000);
                this.timerState.currentSeconds = this.timerState.pausedTime + elapsed;
                this.onTimerUpdate(this.timerState.currentSeconds, this.timerState.isRunning);
                console.log('서버 연결 로컬 타이머 업데이트:', this.timerState.currentSeconds);
            };

            // 다음 초 경계까지 지연 후 인터벌 시작
            const driftMs = (Date.now() - this.timerState.startTime) % 1000;
            const firstDelay = driftMs === 0 ? 1000 : 1000 - driftMs;
            // 시작 즉시 1초 표시(리딩 엣지 업데이트)로 사용자 체감 개선
            try {
                const nowImmediate = Date.now();
                const elapsedImmediate = Math.floor((nowImmediate - this.timerState.startTime) / 1000);
                let initialSeconds = this.timerState.pausedTime + elapsedImmediate;
                if (this.timerState.isRunning && initialSeconds === 0) {
                    initialSeconds = 1; // 0초 고정/2초 점프 방지: 시작 즉시 1초 표시
                }
                this.timerState.currentSeconds = initialSeconds;
                this.onTimerUpdate(this.timerState.currentSeconds, this.timerState.isRunning);
                console.log('서버 연결 로컬 타이머 즉시 표시:', this.timerState.currentSeconds);
            } catch (e) {
                console.warn('초기 즉시 표시 중 경고:', e);
            }

            this.timerState.localTimerInterval = setTimeout(() => {
                scheduleTick();
                this.timerState.localTimerInterval = setInterval(scheduleTick, 1000);
            }, firstDelay);
            console.log('서버 연결 로컬 타이머 시작됨');
        }
        // 서버 연결 끊김 시: 로컬 백업 타이머
        else if (!this.timerState.serverConnected && this.timerState.localIsRunning) {
            const scheduleTickLocal = () => {
                if (!this.timerState.localIsRunning || !this.timerState.localStartTime) return;
                const now = Date.now();
                const elapsed = Math.floor((now - this.timerState.localStartTime) / 1000);
                this.timerState.currentSeconds = this.timerState.localPausedTime + elapsed;
                this.onTimerUpdate(this.timerState.currentSeconds, this.timerState.isRunning);
                console.log('로컬 백업 타이머 업데이트:', this.timerState.currentSeconds);
            };
            const driftMsLocal = (Date.now() - this.timerState.localStartTime) % 1000;
            const firstDelayLocal = driftMsLocal === 0 ? 1000 : 1000 - driftMsLocal;
            this.timerState.localTimerInterval = setTimeout(() => {
                scheduleTickLocal();
                this.timerState.localTimerInterval = setInterval(scheduleTickLocal, 1000);
            }, firstDelayLocal);
            console.log('로컬 백업 타이머 시작됨');
        }
        
        console.log('하이브리드 로컬 타이머 시작됨:', {
            startTime: this.timerState.startTime,
            pausedTime: this.timerState.pausedTime,
            isRunning: this.timerState.isRunning
        });
    }
    
    /**
     * 로컬 타이머 정지
     */
    stopLocalTimer() {
        if (this.timerState.localTimerInterval) {
            clearInterval(this.timerState.localTimerInterval);
            this.timerState.localTimerInterval = null;
        }
        console.log('하이브리드 로컬 타이머 정지됨');
    }
    
    /**
     * 타이머 상태 가져오기
     */
    getTimerState() {
        return {
            currentSeconds: this.timerState.currentSeconds,
            isRunning: this.timerState.isRunning,
            serverConnected: this.timerState.serverConnected,
            localIsRunning: this.timerState.localIsRunning,
            startTime: this.timerState.startTime,
            pausedTime: this.timerState.pausedTime
        };
    }
    
    /**
     * 타이머 상태 설정
     */
    setTimerState(state) {
        this.timerState.currentSeconds = state.currentSeconds || 0;
        this.timerState.isRunning = state.isRunning || false;
        this.timerState.startTime = state.startTime || null;
        this.timerState.pausedTime = state.pausedTime || 0;
        
        // 타이머 표시 업데이트
        this.onTimerUpdate(this.timerState.currentSeconds, this.timerState.isRunning);
    }
    
    /**
     * 하이브리드 타이머 시스템 정리
     */
    destroy() {
        this.stopLocalTimer();
        console.log('하이브리드 타이머 시스템 정리됨');
    }
}

// 전역으로 사용할 수 있도록 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HybridTimerSystem;
} else if (typeof window !== 'undefined') {
    window.HybridTimerSystem = HybridTimerSystem;
}
