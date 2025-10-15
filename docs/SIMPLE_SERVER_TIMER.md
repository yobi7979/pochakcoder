# 단순한 서버 중심 타이머 시스템

## 🎯 핵심 아이디어: 복잡성 제거, 단순성 우선

### 💡 복잡한 NTP 대신 단순한 서버 중심 타이머
- **서버가 유일한 시간 기준**: 복잡한 NTP 동기화 불필요
- **클라이언트는 동기화만**: 서버 시간을 받아서 표시
- **새로고침 시 서버 복원**: 서버에서 상태 복원

## 🏗️ 단순한 서버 중심 타이머 시스템

### 📋 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   컨트롤 패널    │    │   서버 (DB)      │    │   오버레이 페이지 │
│                 │    │                 │    │                 │
│ 서버 시간 동기화│◄──►│ 타이머 상태 저장 │◄──►│ 서버 시간 동기화 │
│ + 로컬 표시     │    │ + 새로고침 복원  │    │ + 로컬 표시     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 핵심 구현 원칙

#### **1. 서버 중심 타이머 관리 (단순함)**
```javascript
// 서버 측: 단순한 타이머 시스템
class SimpleServerTimer {
    constructor() {
        this.timerStates = new Map();
        this.saveInterval = 5000; // 5초마다 DB 저장
    }
    
    // 타이머 시작 (서버 시간 기준)
    startTimer(matchId) {
        const serverTime = Date.now();
        this.timerStates.set(matchId, {
            startTime: serverTime,
            pausedTime: 0,
            isRunning: true,
            lastUpdate: serverTime
        });
        
        console.log('서버 타이머 시작:', { matchId, serverTime });
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
    
    // DB에 저장 (주기적)
    async saveToDatabase(matchId) {
        const state = this.timerStates.get(matchId);
        if (!state) return;
        
        try {
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = match.match_data || {};
                matchData.server_timer_startTime = state.startTime;
                matchData.server_timer_pausedTime = state.pausedTime;
                matchData.server_timer_isRunning = state.isRunning;
                matchData.server_timer_lastUpdate = state.lastUpdate;
                
                await match.update({ match_data: matchData });
                console.log('서버 타이머 DB 저장 완료:', matchId);
            }
        } catch (error) {
            console.error('서버 타이머 DB 저장 실패:', error);
        }
    }
}
```

#### **2. 클라이언트 단순 동기화**
```javascript
// 클라이언트 측: 단순한 서버 동기화
class SimpleClientTimer {
    constructor(matchId) {
        this.matchId = matchId;
        this.timerState = {
            currentSeconds: 0,
            isRunning: false,
            startTime: null,
            pausedTime: 0
        };
    }
    
    // 페이지 로드 시 서버에서 상태 복원
    initialize() {
        // 서버에 타이머 상태 요청
        socket.emit('request_timer_state', { matchId: this.matchId });
    }
    
    // 서버 상태 동기화 (단순함)
    syncWithServer(serverState) {
        this.timerState = { ...serverState };
        this.updateDisplay();
        
        if (this.timerState.isRunning) {
            this.startLocalTimer();
        }
    }
    
    // 로컬 타이머 시작 (서버 동기화)
    startLocalTimer() {
        socket.emit('timer_control', {
            matchId: this.matchId,
            action: 'start'
        });
    }
}
```

### 🌍 단순한 동기화 메커니즘

#### **1. 서버 측 이벤트 처리 (단순함)**
```javascript
// 서버 측: 단순한 WebSocket 이벤트 처리
socket.on('request_timer_state', async (data) => {
    const { matchId } = data;
    const timerSystem = new SimpleServerTimer();
    
    // 메모리에서 타이머 상태 확인
    let state = timerSystem.timerStates.get(matchId);
    
    if (!state) {
        // DB에서 복원 시도
        state = await timerSystem.restoreFromDatabase(matchId);
    }
    
    // 현재 시간 계산
    const currentSeconds = timerSystem.getCurrentTime(matchId);
    
    // 클라이언트에 응답
    socket.emit('timer_state_response', {
        matchId: matchId,
        currentSeconds: currentSeconds,
        isRunning: state.isRunning,
        startTime: state.startTime,
        pausedTime: state.pausedTime
    });
});

socket.on('timer_control', async (data) => {
    const { matchId, action } = data;
    const timerSystem = new SimpleServerTimer();
    
    // 타이머 상태 업데이트
    await timerSystem.updateTimerState(matchId, action);
    
    // 모든 클라이언트에 상태 전송
    io.to(`match_${matchId}`).emit('timer_state_response', {
        matchId: matchId,
        ...updatedState
    });
});
```

#### **2. 클라이언트 단순 복원**
```javascript
// 클라이언트 측: 단순한 복원 로직
document.addEventListener('DOMContentLoaded', function() {
    // 1. 서버에 타이머 상태 요청
    socket.emit('request_timer_state', { matchId: matchId });
    
    // 2. 서버 응답 대기
    socket.on('timer_state_response', function(data) {
        if (data.matchId === matchId) {
            // 3. 타이머 상태 복원 (단순함)
            restoreTimerState(data);
        }
    });
});

// 단순한 타이머 상태 복원
function restoreTimerState(serverData) {
    const { currentSeconds, isRunning, startTime, pausedTime } = serverData;
    
    // 타이머 상태 복원
    timerState.currentSeconds = currentSeconds;
    timerState.isRunning = isRunning;
    timerState.startTime = startTime;
    timerState.pausedTime = pausedTime;
    
    // 디스플레이 업데이트
    updateTimerDisplay();
    
    // 실행 중이면 로컬 타이머 시작
    if (timerState.isRunning) {
        startLocalTimer();
    }
}
```

### 🎯 단순한 서버 중심 타이머의 핵심 장점

#### **1. 구현 단순성**
- **서버 중심**: 서버가 유일한 시간 기준
- **복잡한 동기화 불필요**: NTP 서버 선택, 시간 차이 계산 불필요
- **단순한 로직**: 서버 시간 기준으로 단순 계산

#### **2. 유지보수 용이성**
- **외부 의존성 없음**: NTP 서버 의존성 제거
- **네트워크 독립성**: 인터넷 연결 문제와 무관
- **디버깅 용이**: 서버 시간 기준으로 단순 디버깅

#### **3. 안정성**
- **서버 중심**: 서버가 유일한 진실의 원천
- **새로고침 안전**: 서버에서 상태 복원
- **동기화 보장**: 모든 클라이언트가 동일한 상태

### 🔧 구현 단계 (단순함)

#### **1단계: 서버 중심 타이머 구현**
- [ ] 단순한 서버 타이머 클래스
- [ ] DB 저장/복원 로직
- [ ] WebSocket 이벤트 처리

#### **2단계: 클라이언트 동기화 구현**
- [ ] 서버 상태 동기화 로직
- [ ] 새로고침 시 자동 복원
- [ ] 로컬 타이머와 서버 동기화

#### **3단계: 테스트 및 검증**
- [ ] 새로고침 시 상태 복원 테스트
- [ ] 다중 클라이언트 동기화 테스트
- [ ] 서버 중단 시 복원 테스트

## 📝 결론

단순한 서버 중심 타이머 시스템은 다음과 같은 핵심 원칙을 따릅니다:

1. **서버 중심**: 서버가 유일한 시간 기준
2. **단순한 동기화**: 복잡한 NTP 동기화 불필요
3. **새로고침 안전**: 서버에서 상태 복원
4. **유지보수 용이**: 외부 의존성 없음

**복잡도 비교:**
- **NTP 기반**: 복잡함 (서버 선택, 시간 동기화, 오류 처리)
- **서버 중심**: 단순함 (서버 시간 기준, 단순 동기화)

이를 통해 복잡한 NTP 시스템 없이도 안정적인 타이머 시스템을 구현할 수 있습니다.
