# 🎯 서버 중심 타이머 시스템 설계

## 📋 설계 원칙

### ✅ **핵심 원칙**
1. **서버 중심**: 서버가 유일한 시간 기준
2. **단순성**: 복잡한 동기화 로직 제거
3. **일관성**: 모든 클라이언트가 동일한 상태
4. **안정성**: 새로고침 시 정확한 복원

### 🏗️ **시스템 아키텍처**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   컨트롤 패널    │    │   서버 (기준)    │    │   오버레이 페이지 │
│                 │    │                 │    │                 │
│ 서버 시간 수신  │◄──►│ 서버 시간 기준   │◄──►│ 서버 시간 수신  │
│ + 로컬 표시     │    │ + 타이머 상태   │    │ + 로컬 표시     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 **WebSocket 이벤트 설계**

### **서버 → 클라이언트 이벤트**
```javascript
// 1. 타이머 상태 전송 (서버 → 클라이언트)
socket.emit('timer_state', {
    matchId: matchId,
    currentSeconds: currentSeconds,
    isRunning: isRunning,
    serverTime: Date.now()  // 서버 시간 포함
});

// 2. 타이머 업데이트 (서버 → 클라이언트)
socket.emit('timer_update', {
    matchId: matchId,
    currentSeconds: currentSeconds,
    isRunning: isRunning,
    serverTime: Date.now()
});
```

### **클라이언트 → 서버 이벤트**
```javascript
// 1. 타이머 제어 (클라이언트 → 서버)
socket.emit('timer_control', {
    matchId: matchId,
    action: 'start|stop|reset|set',
    timeValue: timeValue  // set 액션 시에만
});

// 2. 타이머 상태 요청 (클라이언트 → 서버)
socket.emit('request_timer_state', {
    matchId: matchId
});
```

## 🎯 **서버 타이머 로직**

### **핵심 서버 타이머 클래스**
```javascript
class ServerCentricTimer {
    constructor() {
        this.timerStates = new Map();
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
        
        this.broadcastTimerState(matchId);
    }
    
    // 타이머 정지
    stopTimer(matchId) {
        const state = this.timerStates.get(matchId);
        if (state && state.isRunning) {
            const serverTime = Date.now();
            const elapsed = Math.floor((serverTime - state.startTime) / 1000);
            state.pausedTime += elapsed;
            state.isRunning = false;
            state.lastUpdate = serverTime;
            
            this.broadcastTimerState(matchId);
        }
    }
    
    // 타이머 리셋
    resetTimer(matchId) {
        const serverTime = Date.now();
        this.timerStates.set(matchId, {
            startTime: serverTime,
            pausedTime: 0,
            isRunning: false,
            lastUpdate: serverTime
        });
        
        this.broadcastTimerState(matchId);
    }
    
    // 타이머 설정
    setTimer(matchId, minutes, seconds) {
        const serverTime = Date.now();
        const targetTime = minutes * 60 + seconds;
        
        this.timerStates.set(matchId, {
            startTime: serverTime,
            pausedTime: targetTime,
            isRunning: false,
            lastUpdate: serverTime
        });
        
        this.broadcastTimerState(matchId);
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
    
    // 모든 클라이언트에 상태 전송
    broadcastTimerState(matchId) {
        const currentTime = this.getCurrentTime(matchId);
        const state = this.timerStates.get(matchId);
        
        io.to(`match_${matchId}`).emit('timer_state', {
            matchId: matchId,
            currentSeconds: currentTime,
            isRunning: state.isRunning,
            serverTime: Date.now()
        });
    }
}
```

## 🎯 **클라이언트 타이머 로직**

### **핵심 클라이언트 타이머 클래스**
```javascript
class ClientTimer {
    constructor(matchId) {
        this.matchId = matchId;
        this.timerState = {
            currentSeconds: 0,
            isRunning: false,
            serverTime: 0
        };
        this.localTimer = null;
    }
    
    // 서버 상태 수신
    receiveServerState(serverData) {
        const { currentSeconds, isRunning, serverTime } = serverData;
        
        this.timerState = {
            currentSeconds: currentSeconds,
            isRunning: isRunning,
            serverTime: serverTime
        };
        
        this.updateDisplay();
        
        if (this.timerState.isRunning) {
            this.startLocalTimer();
        } else {
            this.stopLocalTimer();
        }
    }
    
    // 로컬 타이머 시작 (서버 동기화)
    startLocalTimer() {
        if (this.localTimer) {
            clearInterval(this.localTimer);
        }
        
        this.localTimer = setInterval(() => {
            // 서버에 현재 상태 요청
            socket.emit('request_timer_state', {
                matchId: this.matchId
            });
        }, 1000);
    }
    
    // 로컬 타이머 정지
    stopLocalTimer() {
        if (this.localTimer) {
            clearInterval(this.localTimer);
            this.localTimer = null;
        }
    }
    
    // 타이머 제어 (서버에 요청)
    controlTimer(action, timeValue = null) {
        socket.emit('timer_control', {
            matchId: this.matchId,
            action: action,
            timeValue: timeValue
        });
    }
    
    // 화면 업데이트
    updateDisplay() {
        const minutes = Math.floor(this.timerState.currentSeconds / 60);
        const seconds = this.timerState.currentSeconds % 60;
        
        // 화면에 시간 표시
        const timeDisplay = document.getElementById('timer-display');
        if (timeDisplay) {
            timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}
```

## 🔧 **구현 단계**

### **1단계: 환경변수 정리**
- `ENABLE_NEW_TIMER` 제거
- 기존 V2 타이머 시스템 제거
- 단일 타이머 시스템으로 통합

### **2단계: WebSocket 이벤트 정리**
- 기존 복잡한 이벤트들 제거
- 단순한 4개 이벤트만 사용:
  - `timer_control` (클라이언트 → 서버)
  - `request_timer_state` (클라이언트 → 서버)
  - `timer_state` (서버 → 클라이언트)
  - `timer_update` (서버 → 클라이언트)

### **3단계: 서버 타이머 로직 구현**
- `websocket/events/timer.js` 완전 재작성
- 서버 중심 타이머 클래스 구현
- DB 저장 로직 단순화

### **4단계: 클라이언트 타이머 로직 구현**
- 컨트롤 패널 타이머 코드 단순화
- 오버레이 페이지 타이머 코드 단순화
- localStorage 의존성 제거

### **5단계: 테스트 및 검증**
- 브라우저 테스트 1차: 기본 동작 확인
- 브라우저 테스트 2차: 새로고침 및 동기화 확인
- 다중 클라이언트 동기화 테스트

## 📝 **장점**

### **1. 단순성**
- 복잡한 동기화 로직 제거
- 단일 타이머 시스템
- 명확한 이벤트 구조

### **2. 안정성**
- 서버 중심으로 일관성 보장
- 새로고침 시 정확한 복원
- 시간대 독립적 동작

### **3. 유지보수성**
- 단순한 코드 구조
- 명확한 책임 분리
- 디버깅 용이

## 🎯 **결론**

서버 중심 타이머 시스템은 복잡한 동기화 문제를 해결하고, 단순하고 안정적인 타이머 시스템을 제공합니다. 모든 클라이언트가 서버 시간을 기준으로 동기화되어 완벽한 일관성을 보장합니다.
