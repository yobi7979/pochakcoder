// SportsCoder 새로운 타이머 시스템 v2
// 기존 타이머 시스템과 완전히 독립적인 새로운 타이머 시스템

const ServerCentricTimer = require('./server-centric');
const HybridTimer = require('./hybrid');
const TimerModeManager = require('./mode-manager');
const TimerSyncManager = require('./sync-manager');

/**
 * 새로운 타이머 시스템 v2 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const newTimerEvents = (socket, io) => {
    console.log('새로운 타이머 시스템 v2 이벤트 설정 시작:', socket.id);
    
    // 새로운 타이머 시스템 인스턴스 생성
    const serverCentricTimer = new ServerCentricTimer();
    const hybridTimer = new HybridTimer();
    const modeManager = new TimerModeManager();
    const syncManager = new TimerSyncManager();
    
    // 새로운 타이머 시스템 이벤트 처리
    // 기존 시스템과 완전히 독립적인 이벤트명 사용
    
    // 서버 중심 타이머 이벤트
    socket.on('timer_v2_control', async (data) => {
        try {
            const { matchId, action, mode } = data;
            console.log(`새로운 타이머 제어 요청: matchId=${matchId}, action=${action}, mode=${mode}`);
            
            // 모드에 따른 타이머 시스템 선택
            const currentMode = modeManager.getCurrentMode(matchId) || mode || 'server-centric';
            
            if (currentMode === 'server-centric') {
                await serverCentricTimer.handleControl(socket, data, io);
            } else if (currentMode === 'hybrid') {
                await hybridTimer.handleControl(socket, data, io);
            }
            
        } catch (error) {
            console.error('새로운 타이머 제어 중 오류 발생:', error);
        }
    });
    
    // 타이머 동기화 이벤트
    socket.on('timer_v2_sync', async (data) => {
        try {
            const { matchId, mode } = data;
            console.log(`새로운 타이머 동기화 요청: matchId=${matchId}, mode=${mode}`);
            
            const currentMode = modeManager.getCurrentMode(matchId) || mode || 'server-centric';
            
            if (currentMode === 'server-centric') {
                await serverCentricTimer.handleSync(socket, data, io);
            } else if (currentMode === 'hybrid') {
                await hybridTimer.handleSync(socket, data, io);
            }
            
        } catch (error) {
            console.error('새로운 타이머 동기화 중 오류 발생:', error);
        }
    });
    
    // 타이머 상태 요청 이벤트
    socket.on('request_timer_v2_state', async (data) => {
        try {
            const { matchId, mode } = data;
            console.log(`새로운 타이머 상태 요청: matchId=${matchId}, mode=${mode}`);
            
            const currentMode = modeManager.getCurrentMode(matchId) || mode || 'server-centric';
            
            if (currentMode === 'server-centric') {
                await serverCentricTimer.handleStateRequest(socket, data, io);
            } else if (currentMode === 'hybrid') {
                await hybridTimer.handleStateRequest(socket, data, io);
            }
            
        } catch (error) {
            console.error('새로운 타이머 상태 요청 처리 중 오류 발생:', error);
        }
    });
    
    // 타이머 모드 전환 이벤트
    socket.on('timer_v2_mode_switch', async (data) => {
        try {
            const { matchId, newMode } = data;
            console.log(`타이머 모드 전환 요청: matchId=${matchId}, newMode=${newMode}`);
            
            const result = await modeManager.switchMode(matchId, newMode);
            
            if (result.success) {
                // 모드 전환 성공 시 클라이언트에 알림
                socket.emit('timer_v2_mode_switched', {
                    matchId: matchId,
                    newMode: newMode,
                    success: true
                });
                
                console.log(`타이머 모드 전환 완료: matchId=${matchId}, newMode=${newMode}`);
            } else {
                socket.emit('timer_v2_mode_switch_failed', {
                    matchId: matchId,
                    newMode: newMode,
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('타이머 모드 전환 중 오류 발생:', error);
        }
    });
    
    // 타이머 동기화 관리 이벤트
    socket.on('timer_v2_sync_manage', async (data) => {
        try {
            const { matchId, action } = data;
            console.log(`타이머 동기화 관리 요청: matchId=${matchId}, action=${action}`);
            
            await syncManager.handleSyncManagement(socket, data, io);
            
        } catch (error) {
            console.error('타이머 동기화 관리 중 오류 발생:', error);
        }
    });
    
    console.log('새로운 타이머 시스템 v2 이벤트 설정 완료:', socket.id);
};

module.exports = newTimerEvents;
