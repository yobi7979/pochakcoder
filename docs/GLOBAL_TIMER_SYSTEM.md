# 글로벌 타이머 시스템 설계

## 🎯 핵심 아이디어: UTC 기준 글로벌 타이머

### 💡 네이버 타이머 방식의 장점
- **전 세계 동일한 시간**: UTC 기준으로 모든 클라이언트가 동일한 시간 참조
- **시간대 독립**: 각 PC의 로컬 시간대와 무관하게 동작
- **글로벌 동기화**: 어느 지역에서든 동일한 타이머 상태

## 🏗️ 글로벌 타이머 시스템 아키텍처

### 📋 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   컨트롤 패널    │    │   글로벌 서버    │    │   오버레이 페이지 │
│                 │    │                 │    │                 │
│ UTC 시간 동기화 │◄──►│ UTC 기준 타이머 │◄──►│ UTC 시간 동기화 │
│ + 로컬 표시     │    │ + 글로벌 상태   │    │ + 로컬 표시     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 핵심 구현 원칙

#### **1. UTC 기준 시간 관리**
```javascript
// 서버 측: UTC 기준 타이머 상태 관리
class GlobalTimerSystem {
    constructor() {
        this.timerStates = new Map();
        this.utcOffset = 0; // UTC 오프셋 (필요시)
    }
    
    // UTC 기준 타이머 시작
    startTimer(matchId) {
        const utcStartTime = Date.now(); // UTC 기준 시작 시간
        this.timerStates.set(matchId, {
            startTime: utcStartTime,
            pausedTime: 0,
            isRunning: true,
            lastUpdate: utcStartTime
        });
    }
    
    // UTC 기준 현재 시간 계산
    getCurrentTime(matchId) {
        const state = this.timerStates.get(matchId);
        if (!state) return 0;
        
        if (state.isRunning) {
            const utcNow = Date.now();
            const elapsed = Math.floor((utcNow - state.startTime) / 1000);
            return state.pausedTime + elapsed;
        }
        
        return state.pausedTime;
    }
}
```

#### **2. 클라이언트 UTC 동기화**
```javascript
// 클라이언트 측: UTC 시간 동기화
class GlobalClientTimer {
    constructor(matchId) {
        this.matchId = matchId;
        this.serverTimeOffset = 0; // 서버와의 시간 차이
        this.timerState = {
            currentSeconds: 0,
            isRunning: false,
            startTime: null,
            pausedTime: 0
        };
    }
    
    // 서버 시간 동기화
    syncWithServer(serverTime, serverState) {
        // 서버와의 시간 차이 계산
        this.serverTimeOffset = serverTime - Date.now();
        
        // 타이머 상태 동기화
        this.timerState = { ...serverState };
        this.updateDisplay();
        
        if (this.timerState.isRunning) {
            this.startLocalTimer();
        }
    }
    
    // 로컬 타이머 시작 (서버 시간 기준)
    startLocalTimer() {
        const serverTime = Date.now() + this.serverTimeOffset;
        // 서버에 UTC 기준 타이머 시작 요청
        socket.emit('global_timer_control', {
            matchId: this.matchId,
            action: 'start',
            utcTime: serverTime
        });
    }
}
```

### 🌍 글로벌 동기화 메커니즘

#### **1. UTC 기준 시간 동기화**
```javascript
// 서버 측: UTC 기준 타이머 이벤트 처리
socket.on('global_timer_control', async (data) => {
    const { matchId, action, utcTime } = data;
    const serverUtcTime = Date.now();
    
    // UTC 시간 차이 보정
    const timeDiff = Math.abs(serverUtcTime - utcTime);
    if (timeDiff > 1000) { // 1초 이상 차이나면 경고
        console.warn(`시간 동기화 차이: ${timeDiff}ms`);
    }
    
    // UTC 기준 타이머 상태 업데이트
    await globalTimerSystem.updateTimerState(matchId, action, serverUtcTime);
    
    // 모든 클라이언트에 UTC 기준 상태 전송
    io.to(`match_${matchId}`).emit('global_timer_state', {
        matchId: matchId,
        utcTime: serverUtcTime,
        ...updatedState
    });
});
```

#### **2. 새로고침 시 UTC 기준 복원**
```javascript
// 클라이언트 측: 새로고침 시 UTC 기준 복원
document.addEventListener('DOMContentLoaded', function() {
    // 1. 서버에 UTC 기준 타이머 상태 요청
    socket.emit('request_global_timer_state', { 
        matchId: matchId,
        clientUtcTime: Date.now()
    });
    
    // 2. 서버 응답 대기
    socket.on('global_timer_state_response', function(data) {
        if (data.matchId === matchId) {
            // 3. UTC 기준 타이머 상태 복원
            restoreGlobalTimerState(data);
        }
    });
});

// UTC 기준 타이머 상태 복원
function restoreGlobalTimerState(serverData) {
    const { utcTime, currentSeconds, isRunning, startTime, pausedTime } = serverData;
    
    // 서버와의 시간 차이 계산
    const serverTimeOffset = utcTime - Date.now();
    
    // 타이머 상태 복원
    timerState.currentSeconds = currentSeconds;
    timerState.isRunning = isRunning;
    timerState.startTime = startTime;
    timerState.pausedTime = pausedTime;
    timerState.serverTimeOffset = serverTimeOffset;
    
    // 디스플레이 업데이트
    updateTimerDisplay();
    
    // 실행 중이면 로컬 타이머 시작
    if (timerState.isRunning) {
        startLocalTimer();
    }
}
```

### 🎯 글로벌 타이머의 핵심 장점

#### **1. 시간대 독립성**
- **UTC 기준**: 전 세계 어디서나 동일한 시간 기준
- **로컬 시간 무관**: 각 PC의 시간대와 무관하게 동작
- **글로벌 동기화**: 어느 지역에서든 동일한 타이머 상태

#### **2. 새로고침 안전성**
- **UTC 기준 복원**: 새로고침 시 UTC 기준으로 정확한 시간 복원
- **시간 차이 보정**: 서버와 클라이언트 간 시간 차이 자동 보정
- **상태 일관성**: 모든 클라이언트가 동일한 상태 유지

#### **3. 확장성**
- **다중 클라이언트**: 여러 PC에서 동일한 타이머 상태
- **글로벌 접근**: 전 세계 어디서나 접근 가능
- **서버 중단 대응**: UTC 기준으로 정확한 시간 복원

### 🔧 구현 단계

#### **1단계: UTC 기준 서버 타이머 구현**
- [ ] UTC 기준 타이머 상태 관리
- [ ] 시간 동기화 메커니즘 구현
- [ ] WebSocket 이벤트 처리

#### **2단계: 클라이언트 UTC 동기화 구현**
- [ ] 서버 시간 동기화 로직
- [ ] UTC 기준 타이머 상태 복원
- [ ] 로컬 타이머와 서버 동기화

#### **3단계: 글로벌 동기화 테스트**
- [ ] 다중 클라이언트 동기화 테스트
- [ ] 새로고침 시 상태 복원 테스트
- [ ] 시간대 차이 보정 테스트

## 📝 결론

글로벌 타이머 시스템은 다음과 같은 핵심 원칙을 따릅니다:

1. **UTC 기준**: 전 세계 동일한 시간 기준
2. **시간대 독립**: 로컬 시간대와 무관한 동작
3. **글로벌 동기화**: 어느 지역에서든 동일한 상태
4. **새로고침 안전**: UTC 기준으로 정확한 복원

이를 통해 네이버 타이머와 같은 글로벌 타이머 시스템을 구현할 수 있습니다.
