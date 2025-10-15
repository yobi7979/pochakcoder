# NTP 기반 글로벌 타이머 시스템

## 🎯 핵심 아이디어: NTP 서버 기반 글로벌 시간 동기화

### 💡 구글/네이버 직접 API 대신 NTP 서버 활용
- **NTP 서버**: 전 세계 표준 시간 서버
- **UTC 기준**: 모든 클라이언트가 동일한 시간 기준
- **시간대 독립**: 로컬 PC 시간대와 무관하게 동작

## 🏗️ NTP 기반 글로벌 타이머 시스템 아키텍처

### 📋 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   컨트롤 패널    │    │   NTP 서버      │    │   오버레이 페이지 │
│                 │    │                 │    │                 │
│ NTP 시간 동기화 │◄──►│ UTC 표준 시간   │◄──►│ NTP 시간 동기화 │
│ + 로컬 표시     │    │ + 글로벌 동기화 │    │ + 로컬 표시     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 핵심 구현 원칙

#### **1. NTP 서버 기반 시간 동기화**
```javascript
// NTP 서버 목록
const ntpServers = [
    'time.google.com',
    'time.nist.gov', 
    'pool.ntp.org',
    'time.windows.com'
];

// NTP 서버에서 UTC 시간 가져오기
class NTPTimeSync {
    constructor() {
        this.ntpServers = ntpServers;
        this.timeOffset = 0; // 서버와의 시간 차이
        this.lastSyncTime = 0;
    }
    
    // NTP 서버에서 정확한 UTC 시간 가져오기
    async getUTCTime() {
        try {
            // World Clock API 사용 (백업)
            const response = await fetch('https://worldtimeapi.org/api/timezone/UTC');
            const data = await response.json();
            const utcTime = new Date(data.utc_datetime).getTime();
            
            // 로컬 시간과의 차이 계산
            this.timeOffset = utcTime - Date.now();
            this.lastSyncTime = Date.now();
            
            console.log('NTP 시간 동기화 완료:', {
                utcTime: utcTime,
                localTime: Date.now(),
                offset: this.timeOffset
            });
            
            return utcTime;
        } catch (error) {
            console.error('NTP 시간 동기화 실패:', error);
            // 백업: 로컬 시간 사용
            return Date.now();
        }
    }
    
    // 동기화된 시간 가져오기
    getSyncedTime() {
        return Date.now() + this.timeOffset;
    }
}
```

#### **2. 서버 측 NTP 기반 타이머 관리**
```javascript
// 서버 측: NTP 기반 타이머 시스템
class NTPBasedTimerSystem {
    constructor() {
        this.timerStates = new Map();
        this.ntpSync = new NTPTimeSync();
        this.syncInterval = 30000; // 30초마다 NTP 동기화
    }
    
    // NTP 기반 타이머 시작
    async startTimer(matchId) {
        const utcStartTime = await this.ntpSync.getUTCTime();
        this.timerStates.set(matchId, {
            startTime: utcStartTime,
            pausedTime: 0,
            isRunning: true,
            lastUpdate: utcStartTime
        });
        
        console.log('NTP 기반 타이머 시작:', {
            matchId: matchId,
            utcStartTime: utcStartTime
        });
    }
    
    // NTP 기반 현재 시간 계산
    async getCurrentTime(matchId) {
        const state = this.timerStates.get(matchId);
        if (!state) return 0;
        
        if (state.isRunning) {
            const utcNow = await this.ntpSync.getUTCTime();
            const elapsed = Math.floor((utcNow - state.startTime) / 1000);
            return state.pausedTime + elapsed;
        }
        
        return state.pausedTime;
    }
    
    // 주기적 NTP 동기화
    startNTPSync() {
        setInterval(async () => {
            await this.ntpSync.getUTCTime();
            console.log('NTP 주기적 동기화 완료');
        }, this.syncInterval);
    }
}
```

#### **3. 클라이언트 측 NTP 동기화**
```javascript
// 클라이언트 측: NTP 기반 타이머 동기화
class NTPClientTimer {
    constructor(matchId) {
        this.matchId = matchId;
        this.ntpSync = new NTPTimeSync();
        this.timerState = {
            currentSeconds: 0,
            isRunning: false,
            startTime: null,
            pausedTime: 0
        };
    }
    
    // 페이지 로드 시 NTP 동기화
    async initialize() {
        // 1. NTP 서버에서 UTC 시간 동기화
        await this.ntpSync.getUTCTime();
        
        // 2. 서버에 NTP 기반 타이머 상태 요청
        socket.emit('request_ntp_timer_state', { 
            matchId: this.matchId,
            clientUTCTime: this.ntpSync.getSyncedTime()
        });
    }
    
    // 서버 상태와 NTP 동기화
    syncWithServer(serverData) {
        const { utcTime, currentSeconds, isRunning, startTime, pausedTime } = serverData;
        
        // NTP 시간 동기화
        this.ntpSync.timeOffset = utcTime - Date.now();
        
        // 타이머 상태 동기화
        this.timerState = {
            currentSeconds: currentSeconds,
            isRunning: isRunning,
            startTime: startTime,
            pausedTime: pausedTime
        };
        
        this.updateDisplay();
        
        if (this.timerState.isRunning) {
            this.startLocalTimer();
        }
    }
    
    // 로컬 타이머 시작 (NTP 동기화)
    startLocalTimer() {
        const syncedTime = this.ntpSync.getSyncedTime();
        socket.emit('ntp_timer_control', {
            matchId: this.matchId,
            action: 'start',
            utcTime: syncedTime
        });
    }
}
```

### 🌍 NTP 기반 글로벌 동기화 메커니즘

#### **1. NTP 서버 선택 및 동기화**
```javascript
// NTP 서버 선택 및 동기화
class NTPServerSelector {
    constructor() {
        this.servers = [
            { name: 'Google', url: 'time.google.com' },
            { name: 'NIST', url: 'time.nist.gov' },
            { name: 'Pool', url: 'pool.ntp.org' },
            { name: 'Windows', url: 'time.windows.com' }
        ];
        this.bestServer = null;
    }
    
    // 최적의 NTP 서버 선택
    async selectBestServer() {
        const results = await Promise.allSettled(
            this.servers.map(server => this.testServer(server))
        );
        
        const successful = results
            .map((result, index) => ({ result, server: this.servers[index] }))
            .filter(({ result }) => result.status === 'fulfilled')
            .sort((a, b) => a.result.value.latency - b.result.value.latency);
        
        if (successful.length > 0) {
            this.bestServer = successful[0].server;
            console.log('최적 NTP 서버 선택:', this.bestServer.name);
            return this.bestServer;
        }
        
        throw new Error('사용 가능한 NTP 서버가 없습니다');
    }
    
    // NTP 서버 테스트
    async testServer(server) {
        const startTime = Date.now();
        try {
            const response = await fetch(`https://worldtimeapi.org/api/timezone/UTC`);
            const data = await response.json();
            const latency = Date.now() - startTime;
            
            return {
                server: server,
                latency: latency,
                utcTime: new Date(data.utc_datetime).getTime()
            };
        } catch (error) {
            throw new Error(`NTP 서버 테스트 실패: ${server.name}`);
        }
    }
}
```

#### **2. 새로고침 시 NTP 기준 복원**
```javascript
// 새로고침 시 NTP 기준 복원
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. NTP 서버에서 UTC 시간 동기화
        const ntpSync = new NTPTimeSync();
        await ntpSync.getUTCTime();
        
        // 2. 서버에 NTP 기반 타이머 상태 요청
        socket.emit('request_ntp_timer_state', { 
            matchId: matchId,
            clientUTCTime: ntpSync.getSyncedTime()
        });
        
        // 3. 서버 응답 대기
        socket.on('ntp_timer_state_response', function(data) {
            if (data.matchId === matchId) {
                // 4. NTP 기준 타이머 상태 복원
                restoreNTPTimerState(data);
            }
        });
        
    } catch (error) {
        console.error('NTP 동기화 실패:', error);
        // 백업: 로컬 시간 사용
        socket.emit('request_timer_state', { matchId: matchId });
    }
});

// NTP 기준 타이머 상태 복원
function restoreNTPTimerState(serverData) {
    const { utcTime, currentSeconds, isRunning, startTime, pausedTime } = serverData;
    
    // NTP 시간 동기화
    const timeOffset = utcTime - Date.now();
    
    // 타이머 상태 복원
    timerState.currentSeconds = currentSeconds;
    timerState.isRunning = isRunning;
    timerState.startTime = startTime;
    timerState.pausedTime = pausedTime;
    timerState.ntpOffset = timeOffset;
    
    // 디스플레이 업데이트
    updateTimerDisplay();
    
    // 실행 중이면 로컬 타이머 시작
    if (timerState.isRunning) {
        startLocalTimer();
    }
}
```

### 🎯 NTP 기반 글로벌 타이머의 핵심 장점

#### **1. 정확한 시간 동기화**
- **NTP 서버**: 전 세계 표준 시간 서버 사용
- **UTC 기준**: 모든 클라이언트가 동일한 시간 기준
- **시간대 독립**: 로컬 PC 시간대와 무관하게 동작

#### **2. 새로고침 안전성**
- **NTP 기준 복원**: 새로고침 시 NTP 기준으로 정확한 시간 복원
- **시간 차이 보정**: NTP 서버와 클라이언트 간 시간 차이 자동 보정
- **상태 일관성**: 모든 클라이언트가 동일한 상태 유지

#### **3. 글로벌 확장성**
- **다중 클라이언트**: 여러 PC에서 동일한 타이머 상태
- **글로벌 접근**: 전 세계 어디서나 접근 가능
- **서버 중단 대응**: NTP 기준으로 정확한 시간 복원

### 🔧 구현 단계

#### **1단계: NTP 서버 기반 시간 동기화 구현**
- [ ] NTP 서버 선택 및 동기화 로직
- [ ] UTC 시간 가져오기 및 오프셋 계산
- [ ] 주기적 NTP 동기화 메커니즘

#### **2단계: 서버 측 NTP 기반 타이머 구현**
- [ ] NTP 기반 타이머 상태 관리
- [ ] UTC 기준 시간 계산
- [ ] WebSocket 이벤트 처리

#### **3단계: 클라이언트 NTP 동기화 구현**
- [ ] 클라이언트 NTP 동기화 로직
- [ ] NTP 기준 타이머 상태 복원
- [ ] 새로고침 시 자동 복원

## 📝 결론

NTP 기반 글로벌 타이머 시스템은 다음과 같은 핵심 원칙을 따릅니다:

1. **NTP 서버 활용**: 전 세계 표준 시간 서버 사용
2. **UTC 기준**: 모든 클라이언트가 동일한 시간 기준
3. **시간대 독립**: 로컬 시간대와 무관한 동작
4. **글로벌 동기화**: 어느 지역에서든 동일한 상태

이를 통해 구글/네이버의 직접적인 타이머 API 없이도 글로벌 타이머 시스템을 구현할 수 있습니다.
