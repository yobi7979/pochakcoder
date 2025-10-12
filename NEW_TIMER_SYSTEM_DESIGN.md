# 새로운 타이머 시스템 설계 및 격리 방안

## 🎯 새로운 타이머 시스템 아키텍처

### 1. 파일 구조 (완전 격리)
```
websocket/events/
├── timer.js (기존 - 수정 금지)
├── timer-v2/ (신규 - 새로운 타이머 시스템)
│   ├── server-centric.js
│   ├── hybrid.js
│   ├── mode-manager.js
│   ├── sync-manager.js
│   └── index.js
└── index.js (기존 - 최소 수정)
```

### 2. 네임스페이스 격리
```javascript
// 기존 시스템 (보호)
const existingTimer = {
    matchTimerData: new Map(),
    startMatchTimer: function(matchId) { /* 기존 로직 */ }
};

// 새로운 시스템 (완전 격리)
const newTimer = {
    serverCentric: new ServerCentricTimer(),
    hybrid: new HybridTimer(),
    modeManager: new TimerModeManager(),
    syncManager: new TimerSyncManager()
};
```

## 🏗️ 새로운 타이머 시스템 설계

### 1. 서버 중심 타이머 시스템
```javascript
// websocket/events/timer-v2/server-centric.js
class ServerCentricTimer {
    constructor() {
        this.timerData = new Map();           // 독립적인 데이터 저장
        this.isActive = false;                // 활성화 상태
        this.syncInterval = 1000;             // 동기화 간격
    }
    
    // 기존 시스템과 완전히 독립적인 메서드들
    startTimer(matchId) { /* 새로운 로직 */ }
    stopTimer(matchId) { /* 새로운 로직 */ }
    resetTimer(matchId) { /* 새로운 로직 */ }
    getCurrentTime(matchId) { /* 새로운 로직 */ }
    
    // 독립적인 WebSocket 이벤트 처리
    handleTimerControl(socket, data) { /* 새로운 로직 */ }
    handleTimerSync(socket, data) { /* 새로운 로직 */ }
    handleTimerState(socket, data) { /* 새로운 로직 */ }
}
```

### 2. 하이브리드 타이머 시스템
```javascript
// websocket/events/timer-v2/hybrid.js
class HybridTimer {
    constructor() {
        this.serverTimer = new ServerTimer();
        this.localTimer = new LocalTimer();
        this.isActive = false;
        this.fallbackMode = false;
    }
    
    // 서버-로컬 타이머 결합 로직
    startTimer(matchId) { /* 새로운 로직 */ }
    stopTimer(matchId) { /* 새로운 로직 */ }
    syncWithServer(matchId) { /* 새로운 로직 */ }
    fallbackToLocal(matchId) { /* 새로운 로직 */ }
}
```

### 3. 타이머 모드 관리 시스템
```javascript
// websocket/events/timer-v2/mode-manager.js
class TimerModeManager {
    constructor() {
        this.currentMode = 'existing';        // 기본값: 기존 시스템
        this.availableModes = ['existing', 'server-centric', 'hybrid'];
        this.modeConfig = new Map();
    }
    
    // 모드 전환 관리
    switchMode(matchId, newMode) { /* 새로운 로직 */ }
    getCurrentMode(matchId) { /* 새로운 로직 */ }
    validateMode(matchId, mode) { /* 새로운 로직 */ }
}
```

## 🔒 완전 격리 방안

### 1. 변수명 격리
```javascript
// 기존 시스템 (보호)
const matchTimerData = new Map();
const pendingDbUpdates = new Map();

// 새로운 시스템 (완전 격리)
const serverCentricTimerData = new Map();
const hybridTimerData = new Map();
const timerModeData = new Map();
const timerSyncData = new Map();
```

### 2. 함수명 격리
```javascript
// 기존 시스템 (보호)
function startMatchTimer(matchId) { /* 기존 로직 */ }
function stopMatchTimer(matchId) { /* 기존 로직 */ }

// 새로운 시스템 (완전 격리)
class ServerCentricTimer {
    startTimer(matchId) { /* 새로운 로직 */ }
    stopTimer(matchId) { /* 새로운 로직 */ }
}

class HybridTimer {
    startTimer(matchId) { /* 새로운 로직 */ }
    stopTimer(matchId) { /* 새로운 로직 */ }
}
```

### 3. WebSocket 이벤트 격리
```javascript
// 기존 시스템 (보호)
socket.on('timer_control', existingHandler);
socket.on('timer_sync', existingHandler);
socket.on('timer_state', existingHandler);

// 새로운 시스템 (완전 격리)
socket.on('timer_v2_control', newHandler);
socket.on('timer_v2_sync', newHandler);
socket.on('timer_v2_state', newHandler);
socket.on('timer_v2_mode_switch', newHandler);
```

### 4. 데이터베이스 격리
```javascript
// 기존 시스템 (보호)
matchData.timer_startTime = timerData.startTime;
matchData.timer_pausedTime = timerData.pausedTime;
matchData.isRunning = timerData.isRunning;

// 새로운 시스템 (완전 격리)
matchData.timer_v2_startTime = newTimerData.startTime;
matchData.timer_v2_pausedTime = newTimerData.pausedTime;
matchData.timer_v2_isRunning = newTimerData.isRunning;
matchData.timer_v2_mode = newTimerData.mode;
```

## 🛡️ 안전한 통합 방안

### 1. 선택적 로딩
```javascript
// websocket/events/index.js (최소 수정)
const setupEvents = (socket, io) => {
    // 기존 이벤트 (항상 로딩)
    timerEvents(socket, io);
    
    // 새로운 이벤트 (선택적 로딩)
    if (process.env.ENABLE_NEW_TIMER === 'true') {
        const newTimerEvents = require('./timer-v2');
        newTimerEvents(socket, io);
    }
};
```

### 2. 모드 기반 활성화
```javascript
// 타이머 모드에 따른 활성화
class TimerModeManager {
    activateTimer(matchId, mode) {
        switch (mode) {
            case 'existing':
                // 기존 타이머 시스템 활성화
                this.activateExistingTimer(matchId);
                break;
            case 'server-centric':
                // 서버 중심 타이머 시스템 활성화
                this.activateServerCentricTimer(matchId);
                break;
            case 'hybrid':
                // 하이브리드 타이머 시스템 활성화
                this.activateHybridTimer(matchId);
                break;
        }
    }
}
```

### 3. 점진적 마이그레이션
```javascript
// 1단계: 기존 시스템 유지
const existingTimer = require('./timer');

// 2단계: 새로운 시스템 추가
const newTimer = require('./timer-v2');

// 3단계: 모드 전환 기능
const modeManager = new TimerModeManager();

// 4단계: 통합 관리
class IntegratedTimerManager {
    constructor() {
        this.existingTimer = existingTimer;
        this.newTimer = newTimer;
        this.modeManager = modeManager;
    }
    
    getTimer(matchId) {
        const mode = this.modeManager.getCurrentMode(matchId);
        return mode === 'existing' ? this.existingTimer : this.newTimer;
    }
}
```

## 🧪 테스트 및 검증 방안

### 1. 단위 테스트
```javascript
// 각 타이머 시스템 독립 테스트
describe('ServerCentricTimer', () => {
    it('should start timer independently', () => {
        const timer = new ServerCentricTimer();
        timer.startTimer('test-match');
        expect(timer.isActive).toBe(true);
    });
});

describe('HybridTimer', () => {
    it('should fallback to local timer when server fails', () => {
        const timer = new HybridTimer();
        timer.simulateServerFailure();
        expect(timer.fallbackMode).toBe(true);
    });
});
```

### 2. 통합 테스트
```javascript
// 기존 시스템과 새로운 시스템 동시 실행 테스트
describe('Timer System Integration', () => {
    it('should not interfere with existing timer', () => {
        const existingTimer = require('./timer');
        const newTimer = require('./timer-v2');
        
        // 기존 타이머 시작
        existingTimer.startMatchTimer('match-1');
        
        // 새로운 타이머 시작
        newTimer.startTimer('match-2');
        
        // 두 타이머가 독립적으로 작동하는지 확인
        expect(existingTimer.getCurrentTime('match-1')).toBeDefined();
        expect(newTimer.getCurrentTime('match-2')).toBeDefined();
    });
});
```

### 3. 성능 테스트
```javascript
// 성능 테스트
describe('Timer Performance', () => {
    it('should not degrade existing system performance', () => {
        const startTime = Date.now();
        
        // 기존 타이머 시스템 성능 테스트
        for (let i = 0; i < 1000; i++) {
            existingTimer.startMatchTimer(`match-${i}`);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 저하가 20% 이하인지 확인
        expect(duration).toBeLessThan(1000); // 1초 이하
    });
});
```

## 📊 모니터링 및 관리

### 1. 실시간 모니터링
```javascript
class TimerSystemMonitor {
    constructor() {
        this.metrics = new Map();
        this.alerts = [];
    }
    
    // 타이머 시스템별 메트릭 수집
    collectMetrics(matchId, systemType) {
        const metrics = {
            timestamp: Date.now(),
            systemType: systemType,
            isActive: this.getSystemStatus(matchId, systemType),
            performance: this.getPerformanceMetrics(matchId, systemType)
        };
        
        this.metrics.set(`${matchId}-${systemType}`, metrics);
    }
    
    // 성능 저하 감지
    detectPerformanceDegradation() {
        // 성능 저하 감지 로직
    }
    
    // 간섭 감지
    detectInterference() {
        // 시스템 간 간섭 감지 로직
    }
}
```

### 2. 자동화된 관리
```javascript
class TimerSystemManager {
    constructor() {
        this.monitor = new TimerSystemMonitor();
        this.autoRecovery = new AutoRecoverySystem();
    }
    
    // 자동 복구 시스템
    handleSystemFailure(matchId, systemType) {
        console.log(`시스템 장애 감지: ${matchId}, ${systemType}`);
        
        // 기존 시스템으로 자동 전환
        this.autoRecovery.switchToExisting(matchId);
        
        // 알림 전송
        this.sendAlert(`타이머 시스템 장애: ${matchId}`);
    }
    
    // 성능 최적화
    optimizePerformance() {
        // 성능 최적화 로직
    }
}
```

## 🎯 구현 우선순위

### 1. 1단계: 기본 구조 구현 (1주)
- [ ] 새로운 타이머 시스템 기본 구조
- [ ] 완전 격리된 파일 구조
- [ ] 기본 클래스 및 인터페이스
- [ ] 단위 테스트 작성

### 2. 2단계: 서버 중심 타이머 구현 (2주)
- [ ] ServerCentricTimer 클래스 구현
- [ ] WebSocket 이벤트 처리 구현
- [ ] 데이터베이스 연동 구현
- [ ] 통합 테스트 작성

### 3. 3단계: 하이브리드 타이머 구현 (2주)
- [ ] HybridTimer 클래스 구현
- [ ] 서버-로컬 타이머 동기화
- [ ] 오프라인 지원 구현
- [ ] 통합 테스트 작성

### 4. 4단계: 모드 관리 시스템 구현 (1주)
- [ ] TimerModeManager 클래스 구현
- [ ] 런타임 모드 전환 기능
- [ ] 설정 관리 시스템
- [ ] 통합 테스트 작성

### 5. 5단계: 통합 및 최적화 (1주)
- [ ] 기존 시스템과의 통합
- [ ] 성능 최적화
- [ ] 모니터링 시스템 구현
- [ ] 최종 테스트 및 검증

## 📝 결론

새로운 타이머 시스템은 다음과 같은 원칙으로 설계되어야 합니다:

1. **완전 격리**: 기존 시스템과 완전히 독립적인 구조
2. **선택적 적용**: 필요에 따라 새로운 시스템 선택 적용
3. **안전한 통합**: 기존 시스템에 영향 없이 안전한 통합
4. **점진적 마이그레이션**: 단계별 안전한 마이그레이션

이 설계를 통해 기존 타이머 시스템을 보호하면서 새로운 기능을 안전하게 추가할 수 있습니다.
