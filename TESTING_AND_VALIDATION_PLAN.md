# 테스트 및 검증 계획

## 🎯 테스트 목표

### 핵심 목표
1. **기존 시스템 보호**: 현재 타이머 시스템이 정상 작동하는지 확인
2. **새로운 시스템 검증**: 새로운 타이머 시스템이 정상 작동하는지 확인
3. **간섭 방지**: 두 시스템 간 간섭이 없는지 확인
4. **성능 유지**: 기존 시스템 성능이 유지되는지 확인

### 검증 기준
- **기능적 검증**: 모든 기능이 정상 작동
- **성능적 검증**: 성능 저하 없이 작동
- **안정성 검증**: 시스템 장애 없이 작동
- **호환성 검증**: 기존 시스템과 호환

## 🧪 단위 테스트 계획

### 1. 기존 타이머 시스템 단위 테스트
```javascript
// 기존 타이머 시스템 테스트
describe('Existing Timer System', () => {
    let existingTimer;
    
    beforeEach(() => {
        existingTimer = require('../websocket/events/timer');
    });
    
    it('should start timer correctly', () => {
        const matchId = 'test-match-1';
        existingTimer.startMatchTimer(matchId);
        
        const timerData = existingTimer.matchTimerData.get(matchId);
        expect(timerData).toBeDefined();
        expect(timerData.isRunning).toBe(true);
        expect(timerData.startTime).toBeGreaterThan(0);
    });
    
    it('should stop timer correctly', () => {
        const matchId = 'test-match-1';
        existingTimer.startMatchTimer(matchId);
        existingTimer.stopMatchTimer(matchId);
        
        const timerData = existingTimer.matchTimerData.get(matchId);
        expect(timerData.isRunning).toBe(false);
        expect(timerData.pausedTime).toBeGreaterThan(0);
    });
    
    it('should reset timer correctly', () => {
        const matchId = 'test-match-1';
        existingTimer.startMatchTimer(matchId);
        existingTimer.resetMatchTimer(matchId);
        
        const timerData = existingTimer.matchTimerData.get(matchId);
        expect(timerData.pausedTime).toBe(0);
        expect(timerData.isRunning).toBe(false);
    });
    
    it('should set timer correctly', () => {
        const matchId = 'test-match-1';
        const minutes = 5;
        const seconds = 30;
        
        existingTimer.setMatchTimer(matchId, minutes, seconds);
        
        const timerData = existingTimer.matchTimerData.get(matchId);
        expect(timerData.pausedTime).toBe(330); // 5분 30초 = 330초
        expect(timerData.isRunning).toBe(false);
    });
});
```

### 2. 새로운 타이머 시스템 단위 테스트
```javascript
// 서버 중심 타이머 시스템 테스트
describe('ServerCentricTimer', () => {
    let serverCentricTimer;
    
    beforeEach(() => {
        serverCentricTimer = new ServerCentricTimer();
    });
    
    it('should start timer independently', () => {
        const matchId = 'test-match-2';
        serverCentricTimer.startTimer(matchId);
        
        expect(serverCentricTimer.isActive).toBe(true);
        expect(serverCentricTimer.timerData.has(matchId)).toBe(true);
    });
    
    it('should stop timer independently', () => {
        const matchId = 'test-match-2';
        serverCentricTimer.startTimer(matchId);
        serverCentricTimer.stopTimer(matchId);
        
        const timerData = serverCentricTimer.timerData.get(matchId);
        expect(timerData.isRunning).toBe(false);
    });
    
    it('should reset timer independently', () => {
        const matchId = 'test-match-2';
        serverCentricTimer.startTimer(matchId);
        serverCentricTimer.resetTimer(matchId);
        
        const timerData = serverCentricTimer.timerData.get(matchId);
        expect(timerData.pausedTime).toBe(0);
        expect(timerData.isRunning).toBe(false);
    });
});

// 하이브리드 타이머 시스템 테스트
describe('HybridTimer', () => {
    let hybridTimer;
    
    beforeEach(() => {
        hybridTimer = new HybridTimer();
    });
    
    it('should start server timer when connected', () => {
        const matchId = 'test-match-3';
        hybridTimer.simulateServerConnection();
        hybridTimer.startTimer(matchId);
        
        expect(hybridTimer.serverTimer.isActive).toBe(true);
        expect(hybridTimer.localTimer.isActive).toBe(false);
    });
    
    it('should fallback to local timer when server fails', () => {
        const matchId = 'test-match-3';
        hybridTimer.startTimer(matchId);
        hybridTimer.simulateServerFailure();
        
        expect(hybridTimer.fallbackMode).toBe(true);
        expect(hybridTimer.localTimer.isActive).toBe(true);
    });
    
    it('should sync with server when reconnected', () => {
        const matchId = 'test-match-3';
        hybridTimer.startTimer(matchId);
        hybridTimer.simulateServerFailure();
        hybridTimer.simulateServerReconnection();
        
        expect(hybridTimer.fallbackMode).toBe(false);
        expect(hybridTimer.serverTimer.isActive).toBe(true);
    });
});
```

### 3. 간섭 방지 테스트
```javascript
// 간섭 방지 테스트
describe('Timer System Interference Prevention', () => {
    let existingTimer;
    let newTimer;
    
    beforeEach(() => {
        existingTimer = require('../websocket/events/timer');
        newTimer = new ServerCentricTimer();
    });
    
    it('should not interfere with existing timer variables', () => {
        const matchId1 = 'existing-match';
        const matchId2 = 'new-match';
        
        // 기존 타이머 시작
        existingTimer.startMatchTimer(matchId1);
        
        // 새로운 타이머 시작
        newTimer.startTimer(matchId2);
        
        // 두 타이머가 독립적으로 작동하는지 확인
        expect(existingTimer.matchTimerData.has(matchId1)).toBe(true);
        expect(newTimer.timerData.has(matchId2)).toBe(true);
        
        // 서로의 데이터에 접근할 수 없는지 확인
        expect(existingTimer.matchTimerData.has(matchId2)).toBe(false);
        expect(newTimer.timerData.has(matchId1)).toBe(false);
    });
    
    it('should not interfere with existing timer functions', () => {
        const matchId = 'test-match';
        
        // 기존 함수 호출
        existingTimer.startMatchTimer(matchId);
        const existingTime = existingTimer.getCurrentTime(matchId);
        
        // 새로운 함수 호출
        newTimer.startTimer(matchId);
        const newTime = newTimer.getCurrentTime(matchId);
        
        // 두 함수가 독립적으로 작동하는지 확인
        expect(existingTime).toBeDefined();
        expect(newTime).toBeDefined();
        expect(existingTime).not.toBe(newTime);
    });
    
    it('should not interfere with WebSocket events', () => {
        const matchId = 'test-match';
        
        // 기존 이벤트 처리
        const existingHandler = jest.fn();
        socket.on('timer_control', existingHandler);
        
        // 새로운 이벤트 처리
        const newHandler = jest.fn();
        socket.on('timer_v2_control', newHandler);
        
        // 기존 이벤트 발생
        socket.emit('timer_control', { matchId, action: 'start' });
        
        // 새로운 이벤트 발생
        socket.emit('timer_v2_control', { matchId, action: 'start' });
        
        // 두 핸들러가 독립적으로 호출되는지 확인
        expect(existingHandler).toHaveBeenCalledTimes(1);
        expect(newHandler).toHaveBeenCalledTimes(1);
    });
});
```

## 🔗 통합 테스트 계획

### 1. 기존 시스템과 새로운 시스템 동시 실행 테스트
```javascript
// 통합 테스트
describe('Timer System Integration', () => {
    let existingTimer;
    let newTimer;
    let server;
    let client;
    
    beforeEach(async () => {
        // 테스트 서버 시작
        server = await startTestServer();
        client = await connectTestClient();
        
        existingTimer = require('../websocket/events/timer');
        newTimer = new ServerCentricTimer();
    });
    
    afterEach(async () => {
        await server.close();
        await client.disconnect();
    });
    
    it('should run both systems simultaneously without interference', async () => {
        const matchId1 = 'existing-match';
        const matchId2 = 'new-match';
        
        // 기존 시스템 시작
        existingTimer.startMatchTimer(matchId1);
        
        // 새로운 시스템 시작
        newTimer.startTimer(matchId2);
        
        // 두 시스템이 독립적으로 작동하는지 확인
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const existingData = existingTimer.matchTimerData.get(matchId1);
        const newData = newTimer.timerData.get(matchId2);
        
        expect(existingData.isRunning).toBe(true);
        expect(newData.isRunning).toBe(true);
        
        // 서로의 데이터에 접근할 수 없는지 확인
        expect(existingTimer.matchTimerData.has(matchId2)).toBe(false);
        expect(newTimer.timerData.has(matchId1)).toBe(false);
    });
    
    it('should handle WebSocket events independently', async () => {
        const matchId = 'test-match';
        
        // 기존 이벤트 처리
        const existingHandler = jest.fn();
        client.on('timer_state', existingHandler);
        
        // 새로운 이벤트 처리
        const newHandler = jest.fn();
        client.on('timer_v2_state', newHandler);
        
        // 기존 이벤트 발생
        client.emit('timer_control', { matchId, action: 'start' });
        
        // 새로운 이벤트 발생
        client.emit('timer_v2_control', { matchId, action: 'start' });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 두 핸들러가 독립적으로 호출되는지 확인
        expect(existingHandler).toHaveBeenCalled();
        expect(newHandler).toHaveBeenCalled();
    });
    
    it('should maintain performance with both systems running', async () => {
        const startTime = Date.now();
        
        // 100개 경기 동시 실행
        for (let i = 0; i < 100; i++) {
            existingTimer.startMatchTimer(`existing-match-${i}`);
            newTimer.startTimer(`new-match-${i}`);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 100개 경기 시작이 1초 이내에 완료
        expect(duration).toBeLessThan(1000);
        
        // 메모리 사용량 확인
        const memoryUsage = process.memoryUsage();
        expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB 이하
    });
});
```

### 2. 데이터베이스 동시 접근 테스트
```javascript
// 데이터베이스 통합 테스트
describe('Database Integration', () => {
    let existingTimer;
    let newTimer;
    let db;
    
    beforeEach(async () => {
        db = await setupTestDatabase();
        existingTimer = require('../websocket/events/timer');
        newTimer = new ServerCentricTimer();
    });
    
    afterEach(async () => {
        await cleanupTestDatabase();
    });
    
    it('should handle concurrent database access', async () => {
        const matchId = 'test-match';
        
        // 기존 시스템 DB 업데이트
        const existingPromise = existingTimer.updateDatabase(matchId, {
            timer_startTime: Date.now(),
            timer_pausedTime: 0,
            isRunning: true
        });
        
        // 새로운 시스템 DB 업데이트
        const newPromise = newTimer.updateDatabase(matchId, {
            timer_v2_startTime: Date.now(),
            timer_v2_pausedTime: 0,
            timer_v2_isRunning: true
        });
        
        // 동시 실행
        await Promise.all([existingPromise, newPromise]);
        
        // 데이터가 독립적으로 저장되는지 확인
        const match = await db.Match.findByPk(matchId);
        expect(match.match_data.timer_startTime).toBeDefined();
        expect(match.match_data.timer_v2_startTime).toBeDefined();
        expect(match.match_data.timer_startTime).not.toBe(match.match_data.timer_v2_startTime);
    });
    
    it('should prevent database conflicts', async () => {
        const matchId = 'test-match';
        
        // 동시에 같은 경기에 대해 다른 시스템이 접근
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
            promises.push(existingTimer.updateDatabase(matchId, {
                timer_startTime: Date.now() + i,
                timer_pausedTime: i,
                isRunning: true
            }));
            
            promises.push(newTimer.updateDatabase(matchId, {
                timer_v2_startTime: Date.now() + i,
                timer_v2_pausedTime: i,
                timer_v2_isRunning: true
            }));
        }
        
        // 모든 업데이트가 성공적으로 완료되는지 확인
        const results = await Promise.allSettled(promises);
        const failures = results.filter(result => result.status === 'rejected');
        
        expect(failures.length).toBe(0);
    });
});
```

## 🚀 성능 테스트 계획

### 1. 단일 경기 타이머 성능 테스트
```javascript
// 성능 테스트
describe('Timer Performance', () => {
    let existingTimer;
    let newTimer;
    
    beforeEach(() => {
        existingTimer = require('../websocket/events/timer');
        newTimer = new ServerCentricTimer();
    });
    
    it('should maintain existing system performance', () => {
        const matchId = 'performance-test';
        const iterations = 1000;
        
        const startTime = Date.now();
        
        for (let i = 0; i < iterations; i++) {
            existingTimer.startMatchTimer(matchId);
            existingTimer.stopMatchTimer(matchId);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 1000번 시작/정지가 1초 이내에 완료
        expect(duration).toBeLessThan(1000);
    });
    
    it('should achieve new system performance targets', () => {
        const matchId = 'performance-test';
        const iterations = 1000;
        
        const startTime = Date.now();
        
        for (let i = 0; i < iterations; i++) {
            newTimer.startTimer(matchId);
            newTimer.stopTimer(matchId);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 1000번 시작/정지가 1초 이내에 완료
        expect(duration).toBeLessThan(1000);
    });
    
    it('should not degrade performance with both systems', () => {
        const matchId1 = 'existing-performance-test';
        const matchId2 = 'new-performance-test';
        const iterations = 500;
        
        const startTime = Date.now();
        
        for (let i = 0; i < iterations; i++) {
            existingTimer.startMatchTimer(matchId1);
            newTimer.startTimer(matchId2);
            existingTimer.stopMatchTimer(matchId1);
            newTimer.stopTimer(matchId2);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 두 시스템 동시 실행 시에도 1초 이내에 완료
        expect(duration).toBeLessThan(1000);
    });
});
```

### 2. 다중 경기 타이머 성능 테스트
```javascript
// 다중 경기 성능 테스트
describe('Multi-Match Performance', () => {
    let existingTimer;
    let newTimer;
    
    beforeEach(() => {
        existingTimer = require('../websocket/events/timer');
        newTimer = new ServerCentricTimer();
    });
    
    it('should handle 10 concurrent matches', () => {
        const matchCount = 10;
        const startTime = Date.now();
        
        // 10개 경기 동시 시작
        for (let i = 0; i < matchCount; i++) {
            existingTimer.startMatchTimer(`existing-match-${i}`);
            newTimer.startTimer(`new-match-${i}`);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 10개 경기 시작이 100ms 이내에 완료
        expect(duration).toBeLessThan(100);
    });
    
    it('should handle 100 concurrent matches', () => {
        const matchCount = 100;
        const startTime = Date.now();
        
        // 100개 경기 동시 시작
        for (let i = 0; i < matchCount; i++) {
            existingTimer.startMatchTimer(`existing-match-${i}`);
            newTimer.startTimer(`new-match-${i}`);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 100개 경기 시작이 500ms 이내에 완료
        expect(duration).toBeLessThan(500);
    });
    
    it('should handle 1000 concurrent matches', () => {
        const matchCount = 1000;
        const startTime = Date.now();
        
        // 1000개 경기 동시 시작
        for (let i = 0; i < matchCount; i++) {
            existingTimer.startMatchTimer(`existing-match-${i}`);
            newTimer.startTimer(`new-match-${i}`);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 성능 기준: 1000개 경기 시작이 2초 이내에 완료
        expect(duration).toBeLessThan(2000);
    });
});
```

### 3. 메모리 사용량 테스트
```javascript
// 메모리 사용량 테스트
describe('Memory Usage', () => {
    let existingTimer;
    let newTimer;
    
    beforeEach(() => {
        existingTimer = require('../websocket/events/timer');
        newTimer = new ServerCentricTimer();
    });
    
    it('should not increase memory usage significantly', () => {
        const initialMemory = process.memoryUsage();
        
        // 100개 경기 생성
        for (let i = 0; i < 100; i++) {
            existingTimer.startMatchTimer(`existing-match-${i}`);
            newTimer.startTimer(`new-match-${i}`);
        }
        
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // 메모리 증가량이 10MB 이하인지 확인
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
    
    it('should clean up memory after timer stops', () => {
        const initialMemory = process.memoryUsage();
        
        // 100개 경기 생성
        for (let i = 0; i < 100; i++) {
            existingTimer.startMatchTimer(`existing-match-${i}`);
            newTimer.startTimer(`new-match-${i}`);
        }
        
        // 모든 경기 정지
        for (let i = 0; i < 100; i++) {
            existingTimer.stopMatchTimer(`existing-match-${i}`);
            newTimer.stopTimer(`new-match-${i}`);
        }
        
        // 가비지 컬렉션 강제 실행
        global.gc();
        
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // 메모리 증가량이 5MB 이하인지 확인
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
});
```

## 🔍 호환성 테스트 계획

### 1. 기존 API 호환성 테스트
```javascript
// API 호환성 테스트
describe('API Compatibility', () => {
    let server;
    let client;
    
    beforeEach(async () => {
        server = await startTestServer();
        client = await connectTestClient();
    });
    
    afterEach(async () => {
        await server.close();
        await client.disconnect();
    });
    
    it('should maintain existing API endpoints', async () => {
        const response = await client.emit('timer_control', {
            matchId: 'test-match',
            action: 'start'
        });
        
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
    });
    
    it('should maintain existing WebSocket events', async () => {
        const eventHandler = jest.fn();
        client.on('timer_state', eventHandler);
        
        client.emit('timer_control', {
            matchId: 'test-match',
            action: 'start'
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        expect(eventHandler).toHaveBeenCalled();
    });
    
    it('should maintain existing data format', async () => {
        const response = await client.emit('request_timer_state', {
            matchId: 'test-match'
        });
        
        expect(response.data).toHaveProperty('matchId');
        expect(response.data).toHaveProperty('currentSeconds');
        expect(response.data).toHaveProperty('isRunning');
        expect(response.data).toHaveProperty('startTime');
        expect(response.data).toHaveProperty('pausedTime');
    });
});
```

### 2. 기존 클라이언트 호환성 테스트
```javascript
// 클라이언트 호환성 테스트
describe('Client Compatibility', () => {
    let server;
    let client;
    
    beforeEach(async () => {
        server = await startTestServer();
        client = await connectTestClient();
    });
    
    afterEach(async () => {
        await server.close();
        await client.disconnect();
    });
    
    it('should work with existing soccer control page', async () => {
        const response = await client.emit('timer_control', {
            matchId: 'soccer-match',
            action: 'start'
        });
        
        expect(response.success).toBe(true);
    });
    
    it('should work with existing soccer template page', async () => {
        const response = await client.emit('timer_control', {
            matchId: 'soccer-match',
            action: 'start'
        });
        
        expect(response.success).toBe(true);
    });
    
    it('should work with existing baseball control page', async () => {
        const response = await client.emit('timer_control', {
            matchId: 'baseball-match',
            action: 'start'
        });
        
        expect(response.success).toBe(true);
    });
    
    it('should work with existing baseball template page', async () => {
        const response = await client.emit('timer_control', {
            matchId: 'baseball-match',
            action: 'start'
        });
        
        expect(response.success).toBe(true);
    });
});
```

### 3. 브라우저 호환성 테스트
```javascript
// 브라우저 호환성 테스트
describe('Browser Compatibility', () => {
    const browsers = ['chrome', 'firefox', 'safari', 'edge'];
    
    browsers.forEach(browser => {
        it(`should work with ${browser}`, async () => {
            const client = await connectTestClient(browser);
            
            const response = await client.emit('timer_control', {
                matchId: 'test-match',
                action: 'start'
            });
            
            expect(response.success).toBe(true);
            
            await client.disconnect();
        });
    });
});
```

## 📊 모니터링 및 관리

### 1. 실시간 모니터링
```javascript
// 모니터링 시스템
class TimerSystemMonitor {
    constructor() {
        this.metrics = new Map();
        this.alerts = [];
    }
    
    // 메트릭 수집
    collectMetrics(matchId, systemType) {
        const metrics = {
            timestamp: Date.now(),
            systemType: systemType,
            isActive: this.getSystemStatus(matchId, systemType),
            performance: this.getPerformanceMetrics(matchId, systemType),
            memory: this.getMemoryUsage(),
            cpu: this.getCpuUsage()
        };
        
        this.metrics.set(`${matchId}-${systemType}`, metrics);
    }
    
    // 성능 저하 감지
    detectPerformanceDegradation() {
        const currentMetrics = Array.from(this.metrics.values());
        const recentMetrics = currentMetrics.filter(m => 
            Date.now() - m.timestamp < 60000 // 최근 1분
        );
        
        if (recentMetrics.length > 0) {
            const avgPerformance = recentMetrics.reduce((sum, m) => 
                sum + m.performance, 0) / recentMetrics.length;
            
            if (avgPerformance > 1000) { // 1초 이상
                this.sendAlert('성능 저하 감지', {
                    avgPerformance,
                    systemCount: recentMetrics.length
                });
            }
        }
    }
    
    // 간섭 감지
    detectInterference() {
        const existingMetrics = Array.from(this.metrics.values())
            .filter(m => m.systemType === 'existing');
        const newMetrics = Array.from(this.metrics.values())
            .filter(m => m.systemType === 'new');
        
        if (existingMetrics.length > 0 && newMetrics.length > 0) {
            const existingPerformance = existingMetrics.reduce((sum, m) => 
                sum + m.performance, 0) / existingMetrics.length;
            const newPerformance = newMetrics.reduce((sum, m) => 
                sum + m.performance, 0) / newMetrics.length;
            
            if (Math.abs(existingPerformance - newPerformance) > 500) {
                this.sendAlert('시스템 간 간섭 감지', {
                    existingPerformance,
                    newPerformance,
                    difference: Math.abs(existingPerformance - newPerformance)
                });
            }
        }
    }
    
    // 알림 전송
    sendAlert(message, data) {
        const alert = {
            timestamp: Date.now(),
            message: message,
            data: data
        };
        
        this.alerts.push(alert);
        console.error('타이머 시스템 알림:', alert);
    }
}
```

### 2. 자동화된 관리
```javascript
// 자동화된 관리 시스템
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
        this.monitor.sendAlert(`타이머 시스템 장애: ${matchId}`, {
            systemType: systemType,
            matchId: matchId,
            recoveryAction: 'switched to existing system'
        });
    }
    
    // 성능 최적화
    optimizePerformance() {
        const metrics = Array.from(this.monitor.metrics.values());
        const recentMetrics = metrics.filter(m => 
            Date.now() - m.timestamp < 300000 // 최근 5분
        );
        
        if (recentMetrics.length > 0) {
            const avgMemory = recentMetrics.reduce((sum, m) => 
                sum + m.memory.heapUsed, 0) / recentMetrics.length;
            const avgCpu = recentMetrics.reduce((sum, m) => 
                sum + m.cpu.usage, 0) / recentMetrics.length;
            
            if (avgMemory > 100 * 1024 * 1024) { // 100MB 이상
                this.cleanupMemory();
            }
            
            if (avgCpu > 80) { // 80% 이상
                this.optimizeCpu();
            }
        }
    }
    
    // 메모리 정리
    cleanupMemory() {
        console.log('메모리 정리 시작');
        
        // 사용하지 않는 타이머 데이터 정리
        const now = Date.now();
        const cutoffTime = now - 3600000; // 1시간 전
        
        for (const [key, metrics] of this.monitor.metrics.entries()) {
            if (metrics.timestamp < cutoffTime) {
                this.monitor.metrics.delete(key);
            }
        }
        
        // 가비지 컬렉션 강제 실행
        if (global.gc) {
            global.gc();
        }
        
        console.log('메모리 정리 완료');
    }
    
    // CPU 최적화
    optimizeCpu() {
        console.log('CPU 최적화 시작');
        
        // 불필요한 타이머 정리
        // 성능 저하를 일으키는 타이머 식별 및 정리
        
        console.log('CPU 최적화 완료');
    }
}
```

## 📝 결론

이 테스트 및 검증 계획은 기존 타이머 시스템을 보호하면서 새로운 타이머 기능을 안전하게 추가하는 것을 목표로 합니다.

**핵심 검증 요소:**
1. **기존 시스템 보호**: 현재 시스템이 정상 작동하는지 확인
2. **새로운 시스템 검증**: 새로운 시스템이 정상 작동하는지 확인
3. **간섭 방지**: 두 시스템 간 간섭이 없는지 확인
4. **성능 유지**: 기존 시스템 성능이 유지되는지 확인

**성공 기준:**
- **기능적 성공**: 모든 기능이 정상 작동
- **성능적 성공**: 성능 저하 없이 작동
- **안정성 성공**: 시스템 장애 없이 작동
- **호환성 성공**: 기존 시스템과 호환

이 계획에 따라 단계별로 테스트를 진행하면서 각 단계마다 철저한 검증을 통해 안전한 구현을 보장하겠습니다.
