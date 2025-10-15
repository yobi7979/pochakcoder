# SportsCoder 타이머 시스템 아키텍처

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [아키텍처 설계](#아키텍처-설계)
3. [핵심 컴포넌트](#핵심-컴포넌트)
4. [데이터 흐름](#데이터-흐름)
5. [WebSocket 이벤트 시스템](#websocket-이벤트-시스템)
6. [데이터베이스 구조](#데이터베이스-구조)
7. [클라이언트-서버 동기화](#클라이언트-서버-동기화)
8. [타이머 상태 관리](#타이머-상태-관리)
9. [오류 처리 및 복구](#오류-처리-및-복구)
10. [성능 최적화](#성능-최적화)
11. [테스트 및 검증](#테스트-및-검증)

## 🎯 시스템 개요

### 핵심 목표
- **서버 중심 타이머**: 서버가 유일한 시간 기준이 되는 단순한 타이머 시스템
- **실시간 동기화**: 컨트롤 페이지와 오버레이 페이지 간 완벽한 동기화
- **지속성 보장**: 서버 재시작 후에도 타이머 상태 복원
- **크로스 플랫폼**: 다른 PC에서도 동일한 타이머 상태 유지

### 주요 특징
- **단일 타이머 시스템**: 기존 V2 버전 제거, 하나의 통합된 시스템
- **서버 중심 설계**: 클라이언트는 표시만 담당, 서버가 모든 로직 처리
- **WebSocket 기반**: 실시간 양방향 통신
- **데이터베이스 영속성**: SQLite/PostgreSQL을 통한 상태 저장

## 🏗️ 아키텍처 설계

### 전체 시스템 구조
```
┌─────────────────────────────────────────────────────────────┐
│                    SportsCoder 타이머 시스템                │
├─────────────────────────────────────────────────────────────┤
│  클라이언트 계층 (Client Layer)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ 컨트롤 페이지    │  │ 오버레이 페이지  │  │ 모바일 컨트롤    │ │
│  │ (soccer-control)│  │ (soccer-template)│  │ (soccer-control-│ │
│  │                 │  │                 │  │ mobile)        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  통신 계층 (Communication Layer)                            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              WebSocket (Socket.IO)                      │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │ timer_state │  │ timer_control│  │ join_match   │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  서버 계층 (Server Layer)                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Express.js Server                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │ 라우터       │  │ 미들웨어     │  │ 컨트롤러     │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  비즈니스 로직 계층 (Business Logic Layer)                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              타이머 이벤트 핸들러                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │ startTimer   │  │ stopTimer    │  │ resetTimer   │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │ setTimer     │  │ broadcastState│  │ saveToDB     │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  데이터 계층 (Data Layer)                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              데이터베이스 (SQLite/PostgreSQL)          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │ Matches      │  │ match_data   │  │ timer_state  │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 핵심 컴포넌트

### 1. 서버 중심 타이머 클래스 (`websocket/events/timer.js`)

#### ServerCentricTimer 클래스
```javascript
class ServerCentricTimer {
    constructor() {
        this.timerStates = global.serverTimerStates; // 전역 타이머 상태 관리
    }
    
    // 핵심 메서드들
    startTimer(matchId, io)     // 타이머 시작
    stopTimer(matchId, io)      // 타이머 정지
    resetTimer(matchId, io)     // 타이머 리셋
    setTimer(matchId, minutes, seconds, io) // 타이머 설정
    getCurrentTime(matchId)     // 현재 시간 계산
    broadcastTimerState(matchId, io) // 상태 브로드캐스트
    saveToDatabase(matchId)     // 데이터베이스 저장
    restoreFromDatabase(matchId) // 데이터베이스 복원
}
```

#### 타이머 상태 구조
```javascript
{
    startTime: 1760502130128,    // 서버 시작 시간 (밀리초)
    pausedTime: 156,             // 정지된 시간 (초)
    isRunning: true,             // 실행 상태
    lastUpdate: 1760502130128    // 마지막 업데이트 시간
}
```

### 2. WebSocket 이벤트 시스템

#### 서버 → 클라이언트 이벤트
- **`timer_state`**: 타이머 상태 전송
  ```javascript
  {
      matchId: "10128917",
      currentSeconds: 156,
      isRunning: true,
      serverTime: 1760502130128,
      pausedTime: 156,
      startTime: 1760502130128
  }
  ```

#### 클라이언트 → 서버 이벤트
- **`request_timer_state`**: 타이머 상태 요청
- **`timer_control`**: 타이머 제어 (start, stop, reset, set)

### 3. 클라이언트 타이머 시스템

#### 컨트롤 페이지 (`views/soccer-control.ejs`)
```javascript
// 타이머 상태 (완전 단순화)
let currentTime = 0;        // 현재 시간 (초)
let isRunning = false;      // 실행 상태

// 핵심 함수들
function startTimer()       // 타이머 시작 요청
function stopTimer()        // 타이머 정지 요청
function resetTimer()       // 타이머 리셋 요청
function updateTimerDisplay() // 타이머 표시 업데이트
function startLocalTimer()  // 로컬 타이머 시작
function stopLocalTimer()   // 로컬 타이머 정지
```

#### 오버레이 페이지 (`views/soccer-template.ejs`)
```javascript
// 서버 타이머 상태 수신
socket.on('timer_state', function(data) {
    // 서버 상태 업데이트
    timerState.currentSeconds = data.currentSeconds || 0;
    timerState.isRunning = data.isRunning || false;
    timerState.startTime = data.startTime || null;
    timerState.pausedTime = data.pausedTime || 0;
    
    // 타이머 디스플레이 업데이트
    updateTimerDisplay();
});
```

## 📊 데이터 흐름

### 1. 타이머 시작 흐름
```
클라이언트 → 서버 → 데이터베이스 → 모든 클라이언트
    ↓         ↓         ↓           ↓
startTimer → startTimer → saveToDB → broadcastState
    ↓         ↓         ↓           ↓
요청 전송 → 상태 업데이트 → 영속성 저장 → 실시간 동기화
```

### 2. 타이머 정지 흐름
```
클라이언트 → 서버 → 데이터베이스 → 모든 클라이언트
    ↓         ↓         ↓           ↓
stopTimer → stopTimer → saveToDB → broadcastState
    ↓         ↓         ↓           ↓
요청 전송 → 상태 업데이트 → 영속성 저장 → 실시간 동기화
```

### 3. 타이머 리셋 흐름
```
클라이언트 → 서버 → 데이터베이스 → 모든 클라이언트
    ↓         ↓         ↓           ↓
resetTimer → resetTimer → saveToDB → broadcastState
    ↓         ↓         ↓           ↓
요청 전송 → 상태 초기화 → 영속성 저장 → 실시간 동기화
```

## 🔄 WebSocket 이벤트 시스템

### 이벤트 처리 흐름
```
1. 클라이언트 연결
   ↓
2. join_match 이벤트 (경기 방 참여)
   ↓
3. request_timer_state 이벤트 (초기 상태 요청)
   ↓
4. timer_state 이벤트 (서버 상태 전송)
   ↓
5. timer_control 이벤트 (타이머 제어)
   ↓
6. broadcastTimerState (모든 클라이언트에 상태 전송)
```

### 이벤트 핸들러 구조
```javascript
// 서버 측 이벤트 핸들러
socket.on('request_timer_state', async (data) => {
    // 초기 타이머 상태 요청 처리
});

socket.on('timer_control', async (data) => {
    // 타이머 제어 요청 처리
    switch (action) {
        case 'start': serverTimer.startTimer(matchId, io); break;
        case 'stop': serverTimer.stopTimer(matchId, io); break;
        case 'reset': serverTimer.resetTimer(matchId, io); break;
        case 'set': serverTimer.setTimer(matchId, minutes, seconds, io); break;
    }
});
```

## 🗄️ 데이터베이스 구조

### Matches 테이블의 match_data 필드
```javascript
{
    // 기존 경기 데이터
    home_score: 0,
    away_score: 0,
    // ... 기타 경기 데이터
    
    // 타이머 상태 데이터
    timer_startTime: 1760502130128,    // 서버 시작 시간
    timer_pausedTime: 156,             // 정지된 시간
    timer_isRunning: true,             // 실행 상태
    timer_lastUpdate: 1760502130128    // 마지막 업데이트 시간
}
```

### 데이터베이스 저장/복원 로직
```javascript
// 저장
async saveToDatabase(matchId) {
    const match = await Match.findByPk(matchId);
    const state = this.timerStates.get(matchId);
    const matchData = { ...match.match_data };
    
    matchData.timer_startTime = state.startTime;
    matchData.timer_pausedTime = state.pausedTime;
    matchData.timer_isRunning = state.isRunning;
    matchData.timer_lastUpdate = state.lastUpdate;
    
    await match.update({ match_data: matchData });
}

// 복원
async restoreFromDatabase(matchId) {
    const match = await Match.findByPk(matchId);
    const matchData = match.match_data;
    
    const restoredState = {
        startTime: matchData.timer_startTime || null,
        pausedTime: matchData.timer_pausedTime || 0,
        isRunning: matchData.timer_isRunning || false,
        lastUpdate: matchData.timer_lastUpdate || null
    };
    
    this.timerStates.set(matchId, restoredState);
    return restoredState;
}
```

## 🔄 클라이언트-서버 동기화

### 동기화 메커니즘
1. **초기 연결 시**: `request_timer_state` 이벤트로 서버 상태 요청
2. **실시간 업데이트**: `timer_state` 이벤트로 서버 상태 수신
3. **로컬 타이머**: `setInterval`로 1초마다 로컬 시간 업데이트
4. **상태 동기화**: 서버 상태와 로컬 상태를 주기적으로 동기화

### 동기화 코드 예시
```javascript
// 클라이언트 측 동기화
socket.on('timer_state', function(data) {
    currentTime = data.currentSeconds || 0;
    isRunning = data.isRunning || false;
    updateTimerDisplay();
    
    if (isRunning) {
        startLocalTimer();
    } else {
        stopLocalTimer();
    }
});

// 로컬 타이머 업데이트
function startLocalTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isRunning) {
            currentTime++;
            updateTimerDisplay();
        }
    }, 1000);
}
```

## 📊 타이머 상태 관리

### 상태 전환 다이어그램
```
[초기 상태] → [시작] → [실행 중] → [정지] → [시작] → [실행 중]
     ↓           ↓         ↓         ↓         ↓         ↓
  00:00      startTimer  진행 중   stopTimer  startTimer  진행 중
     ↓           ↓         ↓         ↓         ↓         ↓
  resetTimer  startTime  currentTime pausedTime startTime currentTime
     ↓           ↓         ↓         ↓         ↓         ↓
  00:00      서버 시간    로컬 증가   정지 시간   서버 시간   로컬 증가
```

### 상태 관리 로직
```javascript
// 시작 시
startTimer(matchId, io) {
    const serverTime = Date.now();
    const currentState = this.timerStates.get(matchId);
    const pausedTime = currentState ? currentState.pausedTime : 0;
    
    this.timerStates.set(matchId, {
        startTime: serverTime,
        pausedTime: pausedTime,  // 기존 정지 시간 유지
        isRunning: true,
        lastUpdate: serverTime
    });
}

// 정지 시
stopTimer(matchId, io) {
    const state = this.timerStates.get(matchId);
    if (state && state.isRunning) {
        const serverTime = Date.now();
        const elapsed = Math.floor((serverTime - state.startTime) / 1000);
        state.pausedTime += elapsed;  // 정지 시간 누적
        state.isRunning = false;
        state.lastUpdate = serverTime;
    }
}
```

## 🛠️ 오류 처리 및 복구

### 오류 처리 메커니즘
1. **WebSocket 연결 실패**: 자동 재연결 시도
2. **서버 응답 없음**: 주기적 상태 요청
3. **데이터베이스 오류**: 메모리 상태 유지
4. **클라이언트 오류**: 서버 상태로 복원

### 복구 코드 예시
```javascript
// 연결 실패 시 재시도
socket.on('disconnect', () => {
    console.log('연결 해제, 재연결 시도...');
    setTimeout(() => {
        socket.connect();
    }, 1000);
});

// 서버 상태 요청 (재연결 시)
socket.on('connect', () => {
    socket.emit('request_timer_state', { matchId: matchId });
});
```

## ⚡ 성능 최적화

### 최적화 전략
1. **메모리 기반 상태 관리**: `global.serverTimerStates` 사용
2. **주기적 데이터베이스 저장**: 상태 변경 시에만 저장
3. **효율적인 브로드캐스트**: 필요한 클라이언트에게만 전송
4. **로컬 타이머 최적화**: 1초 간격으로 업데이트

### 성능 모니터링
```javascript
// 타이머 상태 전송 로그
console.log(`서버 타이머 상태 전송: matchId=${matchId}, currentSeconds=${currentTime}, isRunning=${state.isRunning}`);

// 데이터베이스 저장 로그
console.log(`서버 타이머 DB 저장 완료: matchId=${matchId}`);

// 클라이언트 상태 업데이트 로그
console.log('타이머 상태 업데이트:', { currentTime, isRunning });
```

## 🧪 테스트 및 검증

### 테스트 시나리오
1. **기본 기능 테스트**
   - 타이머 시작/정지/리셋
   - 시간 수정 및 적용
   - 실시간 동기화

2. **지속성 테스트**
   - 서버 재시작 후 상태 복원
   - 페이지 새로고침 후 상태 복원
   - 데이터베이스 저장/복원

3. **동기화 테스트**
   - 컨트롤 페이지와 오버레이 페이지 동기화
   - 다중 클라이언트 동기화
   - 네트워크 지연 시 동기화

### 검증 결과
- ✅ **타이머 정지 후 시작**: 정지된 시간에서 정상 재시작
- ✅ **타이머 수정 후 시작**: 수정된 시간에서 정상 시작
- ✅ **서버 재시작 후 복원**: 타이머 상태 정상 복원
- ✅ **실시간 동기화**: 컨트롤/오버레이 페이지 완벽 동기화
- ✅ **지속성 보장**: 페이지 새로고침 후 상태 유지

## 📝 결론

### 구현된 핵심 기능
1. **서버 중심 타이머 시스템**: 서버가 유일한 시간 기준
2. **실시간 WebSocket 통신**: 양방향 실시간 동기화
3. **데이터베이스 영속성**: SQLite/PostgreSQL을 통한 상태 저장
4. **크로스 플랫폼 지원**: 다른 PC에서도 동일한 타이머 상태
5. **오류 복구**: 연결 실패 시 자동 복구

### 기술적 장점
- **단순성**: 복잡한 클라이언트 로직 제거
- **안정성**: 서버 중심의 일관된 상태 관리
- **확장성**: 다중 클라이언트 지원
- **지속성**: 서버 재시작 후에도 상태 유지

### 향후 개선 방향
1. **성능 최적화**: 대용량 동시 접속 지원
2. **모니터링**: 실시간 상태 모니터링 시스템
3. **백업**: 자동 백업 및 복원 시스템
4. **로깅**: 상세한 로그 및 분석 시스템

이 타이머 시스템은 SportsCoder 프로젝트의 핵심 기능으로, 안정적이고 확장 가능한 실시간 타이머 서비스를 제공합니다.
