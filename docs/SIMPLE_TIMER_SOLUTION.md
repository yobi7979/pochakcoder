# 단순한 타이머 시스템 해결 방안

## 🎯 핵심 문제점
**새로고침 시 타이머 상태 복원 실패** - 컨트롤 패널과 오버레이 페이지를 새로고침해도 타이머가 계속 지속된 상태로 복원되어야 함

## ❌ 현재 문제점

### 1. **복잡한 복원 로직**
- **localStorage + 서버 DB** 이중 저장 방식
- **여러 이벤트 핸들러** 충돌 가능성
- **시간 계산 로직** 복잡성

### 2. **새로고침 시 문제점**
- **컨트롤 패널**: localStorage에서 복원하지만 서버와 동기화 실패
- **오버레이 페이지**: 서버 상태 요청하지만 복원 로직 부족
- **시간 차이**: 새로고침 시점과 저장 시점 간 시간 차이 계산 오류

## 🏗️ 단순한 해결 방안: **서버 중심 단일 저장소**

### 📋 핵심 원칙
```javascript
// 1. 서버가 유일한 진실의 원천 (Single Source of Truth)
// 2. 새로고침 시 서버에서 상태 복원
// 3. 로컬은 서버 상태 동기화만 담당
// 4. 복잡한 localStorage 로직 제거
```

### 🎯 단순한 아키텍처
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   컨트롤 패널    │    │   서버 (DB)      │    │   오버레이 페이지 │
│                 │    │                 │    │                 │
│ 서버 상태 동기화│◄──►│ 타이머 상태 저장 │◄──►│ 서버 상태 동기화 │
│ + 로컬 표시     │    │ + 새로고침 복원  │    │ + 로컬 표시     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 구현 방안

### **1단계: 서버 중심 타이머 상태 관리**

#### **서버 측 (websocket/events/timer-simple.js)**
```javascript
// 단순한 서버 중심 타이머 시스템
class SimpleTimerSystem {
    constructor() {
        this.timerStates = new Map(); // 메모리 저장
        this.saveInterval = 5000; // 5초마다 DB 저장
    }
    
    // 타이머 상태 저장 (메모리 + DB)
    saveTimerState(matchId, state) {
        // 1. 메모리에 즉시 저장
        this.timerStates.set(matchId, {
            ...state,
            lastUpdate: Date.now()
        });
        
        // 2. DB에 저장 (비동기)
        this.saveToDatabase(matchId, state);
    }
    
    // 타이머 상태 복원 (새로고침 시)
    async restoreTimerState(matchId) {
        // 1. 메모리에서 확인
        let state = this.timerStates.get(matchId);
        
        // 2. 메모리에 없으면 DB에서 복원
        if (!state) {
            state = await this.loadFromDatabase(matchId);
            if (state) {
                this.timerStates.set(matchId, state);
            }
        }
        
        // 3. 실행 중이면 경과 시간 계산
        if (state && state.isRunning && state.startTime) {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            state.currentSeconds = state.pausedTime + elapsed;
        }
        
        return state;
    }
}
```

#### **클라이언트 측 (컨트롤 패널)**
```javascript
// 단순한 클라이언트 타이머 시스템
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
    async initialize() {
        // 서버에 타이머 상태 요청
        socket.emit('request_timer_state', { matchId: this.matchId });
    }
    
    // 서버 상태 동기화
    syncWithServer(serverState) {
        this.timerState = { ...serverState };
        this.updateDisplay();
        
        if (this.timerState.isRunning) {
            this.startLocalTimer();
        }
    }
    
    // 로컬 타이머 시작 (서버 상태 동기화)
    startLocalTimer() {
        // 서버에 타이머 시작 요청
        socket.emit('timer_control', {
            matchId: this.matchId,
            action: 'start'
        });
    }
}
```

### **2단계: 새로고침 시 자동 복원**

#### **컨트롤 패널 (soccer-control.ejs)**
```javascript
// 페이지 로드 시 자동 복원
document.addEventListener('DOMContentLoaded', function() {
    // 1. 서버에 타이머 상태 요청
    socket.emit('request_timer_state', { matchId: matchId });
    
    // 2. 서버 응답 대기
    socket.on('timer_state_response', function(data) {
        if (data.matchId === matchId) {
            // 3. 타이머 상태 복원
            restoreTimerState(data);
        }
    });
});

// 타이머 상태 복원 함수
function restoreTimerState(serverState) {
    timerState.currentSeconds = serverState.currentSeconds || 0;
    timerState.isRunning = serverState.isRunning || false;
    timerState.startTime = serverState.startTime || null;
    timerState.pausedTime = serverState.pausedTime || 0;
    
    // 디스플레이 업데이트
    updateTimerDisplay();
    
    // 실행 중이면 로컬 타이머 시작
    if (timerState.isRunning) {
        startLocalTimer();
    }
}
```

#### **오버레이 페이지 (soccer-template.ejs)**
```javascript
// 페이지 로드 시 자동 복원
document.addEventListener('DOMContentLoaded', function() {
    // 1. 서버에 타이머 상태 요청
    socket.emit('request_timer_state', { matchId: matchId });
    
    // 2. 서버 응답 대기
    socket.on('timer_state_response', function(data) {
        if (data.matchId === matchId) {
            // 3. 타이머 상태 복원
            restoreTimerState(data);
        }
    });
});

// 타이머 상태 복원 함수 (컨트롤 패널과 동일)
function restoreTimerState(serverState) {
    timerState.currentSeconds = serverState.currentSeconds || 0;
    timerState.isRunning = serverState.isRunning || false;
    timerState.startTime = serverState.startTime || null;
    timerState.pausedTime = serverState.pausedTime || 0;
    
    // 디스플레이 업데이트
    updateTimerDisplay();
    
    // 실행 중이면 로컬 타이머 시작
    if (timerState.isRunning) {
        startLocalTimer();
    }
}
```

### **3단계: 실시간 동기화**

#### **WebSocket 이벤트 처리**
```javascript
// 서버 측 이벤트 처리
socket.on('request_timer_state', async (data) => {
    const { matchId } = data;
    const state = await timerSystem.restoreTimerState(matchId);
    
    socket.emit('timer_state_response', {
        matchId: matchId,
        ...state
    });
});

socket.on('timer_control', async (data) => {
    const { matchId, action } = data;
    
    // 타이머 상태 업데이트
    await timerSystem.updateTimerState(matchId, action);
    
    // 모든 클라이언트에 상태 전송
    io.to(`match_${matchId}`).emit('timer_state_response', {
        matchId: matchId,
        ...updatedState
    });
});
```

## 🎯 핵심 장점

### **1. 단순성**
- **서버 중심**: 서버가 유일한 진실의 원천
- **복원 로직 단순**: 새로고침 시 서버에서 상태 복원
- **localStorage 제거**: 복잡한 로컬 저장 로직 제거

### **2. 안정성**
- **데이터 일관성**: 서버 DB에만 저장
- **동기화 보장**: 모든 클라이언트가 동일한 상태
- **새로고침 안전**: 언제든지 상태 복원 가능

### **3. 확장성**
- **다중 클라이언트**: 여러 PC에서 동일한 상태 유지
- **시간대 독립**: 서버 시간 기준으로 통일
- **서버 중단 대응**: DB에 저장되어 복원 가능

## 📋 구현 단계

### **1단계: 서버 중심 타이머 시스템 구현**
- [ ] 단순한 서버 타이머 클래스 구현
- [ ] DB 저장/복원 로직 구현
- [ ] WebSocket 이벤트 처리 구현

### **2단계: 클라이언트 복원 로직 구현**
- [ ] 컨트롤 패널 복원 로직 구현
- [ ] 오버레이 페이지 복원 로직 구현
- [ ] localStorage 로직 제거

### **3단계: 실시간 동기화 구현**
- [ ] WebSocket 이벤트 통합
- [ ] 실시간 상태 전파
- [ ] 새로고침 시 자동 복원

## 📝 결론

이 단순한 해결 방안은 다음과 같은 핵심 원칙을 따릅니다:

1. **서버 중심**: 서버가 유일한 진실의 원천
2. **단순한 복원**: 새로고침 시 서버에서 상태 복원
3. **실시간 동기화**: WebSocket을 통한 실시간 상태 전파
4. **복잡성 제거**: localStorage 및 복잡한 로직 제거

이를 통해 새로고침 시에도 타이머 상태가 완벽하게 복원되고, 모든 클라이언트가 동일한 상태를 유지할 수 있습니다.
