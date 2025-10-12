// SportsCoder 타이머 모드 관리 시스템 v2
// 기존 타이머 시스템과 새로운 타이머 시스템 간의 모드 전환 관리

class TimerModeManager {
    constructor() {
        // 모드 관리 데이터
        this.timerModeData = new Map();
        this.currentMode = 'existing'; // 기본값: 기존 시스템
        this.availableModes = ['existing', 'server-centric', 'hybrid'];
        this.modeConfig = new Map();
        
        // 모드별 설정
        this.modeConfig.set('existing', {
            name: '기존 타이머 시스템',
            description: '현재 사용 중인 기존 타이머 시스템',
            features: ['하이브리드 방식', '로컬 시간 보정', '오프라인 지원'],
            performance: 'medium',
            stability: 'high'
        });
        
        this.modeConfig.set('server-centric', {
            name: '서버 중심 타이머 시스템',
            description: '서버가 모든 타이머 상태를 관리하는 시스템',
            features: ['완벽한 동기화', '시간대 독립적', '서버 일관성'],
            performance: 'high',
            stability: 'medium'
        });
        
        this.modeConfig.set('hybrid', {
            name: '하이브리드 타이머 시스템',
            description: '서버 연결 시 서버 중심, 서버 중단 시 로컬 타이머로 전환',
            features: ['서버 중심 동작', '오프라인 지원', '자동 전환'],
            performance: 'high',
            stability: 'high'
        });
        
        console.log('타이머 모드 관리 시스템 초기화 완료');
    }
    
    /**
     * 현재 모드 가져오기
     * @param {string} matchId - 경기 ID
     * @returns {string} 현재 모드
     */
    getCurrentMode(matchId) {
        const modeData = this.timerModeData.get(matchId);
        return modeData ? modeData.currentMode : this.currentMode;
    }
    
    /**
     * 모드 전환
     * @param {string} matchId - 경기 ID
     * @param {string} newMode - 새로운 모드
     * @returns {Object} 전환 결과
     */
    async switchMode(matchId, newMode) {
        console.log(`타이머 모드 전환 요청: matchId=${matchId}, newMode=${newMode}`);
        
        try {
            // 모드 유효성 검증
            if (!this.availableModes.includes(newMode)) {
                return {
                    success: false,
                    error: `지원하지 않는 모드입니다: ${newMode}`,
                    availableModes: this.availableModes
                };
            }
            
            // 현재 모드 가져오기
            const currentMode = this.getCurrentMode(matchId);
            
            // 동일한 모드인 경우
            if (currentMode === newMode) {
                return {
                    success: true,
                    message: `이미 ${newMode} 모드입니다.`,
                    currentMode: newMode
                };
            }
            
            // 모드 전환 전 검증
            const validationResult = await this.validateModeSwitch(matchId, currentMode, newMode);
            if (!validationResult.success) {
                return validationResult;
            }
            
            // 모드 전환 실행
            const switchResult = await this.executeModeSwitch(matchId, currentMode, newMode);
            if (!switchResult.success) {
                return switchResult;
            }
            
            // 모드 데이터 업데이트
            this.timerModeData.set(matchId, {
                currentMode: newMode,
                previousMode: currentMode,
                switchTime: Date.now(),
                switchCount: (this.timerModeData.get(matchId)?.switchCount || 0) + 1
            });
            
            console.log(`타이머 모드 전환 완료: matchId=${matchId}, ${currentMode} -> ${newMode}`);
            
            return {
                success: true,
                message: `모드 전환 완료: ${currentMode} -> ${newMode}`,
                currentMode: newMode,
                previousMode: currentMode,
                switchTime: Date.now()
            };
            
        } catch (error) {
            console.error('타이머 모드 전환 중 오류 발생:', error);
            return {
                success: false,
                error: `모드 전환 중 오류 발생: ${error.message}`
            };
        }
    }
    
    /**
     * 모드 전환 검증
     * @param {string} matchId - 경기 ID
     * @param {string} currentMode - 현재 모드
     * @param {string} newMode - 새로운 모드
     * @returns {Object} 검증 결과
     */
    async validateModeSwitch(matchId, currentMode, newMode) {
        console.log(`모드 전환 검증: matchId=${matchId}, ${currentMode} -> ${newMode}`);
        
        try {
            // 모드 전환 가능성 검증
            if (currentMode === 'existing' && newMode === 'server-centric') {
                // 기존 -> 서버 중심: 가능
                return { success: true };
            } else if (currentMode === 'existing' && newMode === 'hybrid') {
                // 기존 -> 하이브리드: 가능
                return { success: true };
            } else if (currentMode === 'server-centric' && newMode === 'hybrid') {
                // 서버 중심 -> 하이브리드: 가능
                return { success: true };
            } else if (currentMode === 'server-centric' && newMode === 'existing') {
                // 서버 중심 -> 기존: 가능
                return { success: true };
            } else if (currentMode === 'hybrid' && newMode === 'server-centric') {
                // 하이브리드 -> 서버 중심: 가능
                return { success: true };
            } else if (currentMode === 'hybrid' && newMode === 'existing') {
                // 하이브리드 -> 기존: 가능
                return { success: true };
            } else {
                return {
                    success: false,
                    error: `지원하지 않는 모드 전환입니다: ${currentMode} -> ${newMode}`
                };
            }
        } catch (error) {
            console.error('모드 전환 검증 중 오류 발생:', error);
            return {
                success: false,
                error: `모드 전환 검증 중 오류 발생: ${error.message}`
            };
        }
    }
    
    /**
     * 모드 전환 실행
     * @param {string} matchId - 경기 ID
     * @param {string} currentMode - 현재 모드
     * @param {string} newMode - 새로운 모드
     * @returns {Object} 전환 결과
     */
    async executeModeSwitch(matchId, currentMode, newMode) {
        console.log(`모드 전환 실행: matchId=${matchId}, ${currentMode} -> ${newMode}`);
        
        try {
            // 모드별 전환 로직 실행
            switch (newMode) {
                case 'existing':
                    await this.switchToExisting(matchId);
                    break;
                case 'server-centric':
                    await this.switchToServerCentric(matchId);
                    break;
                case 'hybrid':
                    await this.switchToHybrid(matchId);
                    break;
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('모드 전환 실행 중 오류 발생:', error);
            return {
                success: false,
                error: `모드 전환 실행 중 오류 발생: ${error.message}`
            };
        }
    }
    
    /**
     * 기존 모드로 전환
     * @param {string} matchId - 경기 ID
     */
    async switchToExisting(matchId) {
        console.log(`기존 모드로 전환: matchId=${matchId}`);
        
        // 기존 타이머 시스템 활성화
        // 새로운 타이머 시스템 비활성화
        // 기존 WebSocket 이벤트 활성화
        // 새로운 WebSocket 이벤트 비활성화
        
        console.log(`기존 모드 전환 완료: matchId=${matchId}`);
    }
    
    /**
     * 서버 중심 모드로 전환
     * @param {string} matchId - 경기 ID
     */
    async switchToServerCentric(matchId) {
        console.log(`서버 중심 모드로 전환: matchId=${matchId}`);
        
        // 서버 중심 타이머 시스템 활성화
        // 기존 타이머 시스템 비활성화
        // 새로운 WebSocket 이벤트 활성화
        // 기존 WebSocket 이벤트 비활성화
        
        console.log(`서버 중심 모드 전환 완료: matchId=${matchId}`);
    }
    
    /**
     * 하이브리드 모드로 전환
     * @param {string} matchId - 경기 ID
     */
    async switchToHybrid(matchId) {
        console.log(`하이브리드 모드로 전환: matchId=${matchId}`);
        
        // 하이브리드 타이머 시스템 활성화
        // 기존 타이머 시스템 비활성화
        // 새로운 WebSocket 이벤트 활성화
        // 기존 WebSocket 이벤트 비활성화
        
        console.log(`하이브리드 모드 전환 완료: matchId=${matchId}`);
    }
    
    /**
     * 사용 가능한 모드 목록 가져오기
     * @returns {Array} 사용 가능한 모드 목록
     */
    getAvailableModes() {
        return this.availableModes.map(mode => ({
            mode: mode,
            ...this.modeConfig.get(mode)
        }));
    }
    
    /**
     * 모드별 설정 가져오기
     * @param {string} mode - 모드
     * @returns {Object} 모드 설정
     */
    getModeConfig(mode) {
        return this.modeConfig.get(mode) || null;
    }
    
    /**
     * 모드 통계 가져오기
     * @param {string} matchId - 경기 ID
     * @returns {Object} 모드 통계
     */
    getModeStatistics(matchId) {
        const modeData = this.timerModeData.get(matchId);
        if (!modeData) {
            return {
                currentMode: this.currentMode,
                switchCount: 0,
                lastSwitchTime: null
            };
        }
        
        return {
            currentMode: modeData.currentMode,
            previousMode: modeData.previousMode,
            switchCount: modeData.switchCount,
            lastSwitchTime: modeData.switchTime
        };
    }
    
    /**
     * 모든 경기의 모드 통계 가져오기
     * @returns {Object} 전체 모드 통계
     */
    getAllModeStatistics() {
        const statistics = {
            totalMatches: this.timerModeData.size,
            modeDistribution: {},
            totalSwitches: 0
        };
        
        for (const [matchId, modeData] of this.timerModeData.entries()) {
            const mode = modeData.currentMode;
            statistics.modeDistribution[mode] = (statistics.modeDistribution[mode] || 0) + 1;
            statistics.totalSwitches += modeData.switchCount;
        }
        
        return statistics;
    }
}

module.exports = TimerModeManager;
