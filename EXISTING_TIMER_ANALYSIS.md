# 기존 타이머 시스템 분석 보고서

## 📋 기존 타이머 시스템 핵심 요소

### 1. 핵심 변수 (보호 대상)
```javascript
// websocket/events/timer.js
const matchTimerData = new Map();           // 타이머 데이터 저장
const pendingDbUpdates = new Map();         // DB 업데이트 대기열
const DB_BATCH_INTERVAL = 5000;            // 배치 업데이트 간격
```

### 2. 핵심 함수 (보호 대상)
```javascript
// 타이머 관리 함수들
function startMatchTimer(matchId) { /* 기존 로직 */ }
function stopMatchTimer(matchId, clientTime = null) { /* 기존 로직 */ }
function resetMatchTimer(matchId) { /* 기존 로직 */ }
function setMatchTimer(matchId, minutes, seconds) { /* 기존 로직 */ }
```

### 3. WebSocket 이벤트 (보호 대상)
```javascript
// 기존 WebSocket 이벤트들
socket.on('timer_sync', async (data) => { /* 기존 로직 */ });
socket.on('request_timer_state', async (data) => { /* 기존 로직 */ });
socket.on('timer_control', async (data) => { /* 기존 로직 */ });
```

### 4. 데이터베이스 연동 (보호 대상)
```javascript
// Match 모델을 통한 DB 연동
const { Match } = require('../../models');
await match.update({ match_data: matchData });
```

## 🛡️ 기존 시스템 보호 방안

### 1. 변수명 보호
- **기존 변수명 유지**: `matchTimerData`, `pendingDbUpdates`, `DB_BATCH_INTERVAL`
- **새로운 변수명 사용**: `serverCentricTimerData`, `hybridTimerData`, `timerModeData`

### 2. 함수명 보호
- **기존 함수명 유지**: `startMatchTimer`, `stopMatchTimer`, `resetMatchTimer`, `setMatchTimer`
- **새로운 함수명 사용**: `startServerCentricTimer`, `startHybridTimer`, `resetServerCentricTimer`, `resetHybridTimer`

### 3. WebSocket 이벤트 보호
- **기존 이벤트 유지**: `timer_sync`, `request_timer_state`, `timer_control`
- **새로운 이벤트 사용**: `timer_v2_sync`, `request_timer_v2_state`, `timer_v2_control`

### 4. 데이터베이스 보호
- **기존 DB 필드 유지**: `timer_startTime`, `timer_pausedTime`, `isRunning`
- **새로운 DB 필드 사용**: `timer_v2_startTime`, `timer_v2_pausedTime`, `timer_v2_isRunning`

## ⚠️ 간섭 위험 요소 분석

### 1. 변수 간섭 위험
**위험 요소:**
- 새로운 타이머 시스템이 `matchTimerData` Map을 수정
- `pendingDbUpdates` Map 충돌
- 전역 변수 충돌

**보호 방안:**
- 완전한 네임스페이스 격리
- 독립적인 Map 사용
- 전역 변수 사용 금지

### 2. 함수 간섭 위험
**위험 요소:**
- 새로운 타이머 시스템이 기존 함수를 오버라이드
- 함수명 충돌
- 로직 충돌

**보호 방안:**
- 독립적인 함수명 사용
- 클래스 기반 구조 사용
- 네임스페이스 격리

### 3. WebSocket 이벤트 간섭 위험
**위험 요소:**
- 새로운 이벤트가 기존 이벤트와 충돌
- 이벤트 핸들러 충돌
- 데이터 형식 충돌

**보호 방안:**
- 완전히 다른 이벤트명 사용
- 독립적인 이벤트 핸들러
- 데이터 형식 검증

### 4. 데이터베이스 간섭 위험
**위험 요소:**
- 새로운 시스템이 기존 DB 필드 수정
- 트랜잭션 충돌
- 데이터 손실

**보호 방안:**
- 독립적인 DB 필드 사용
- 트랜잭션 격리
- 데이터 백업

## 🔍 기존 시스템 영향도 분석

### 1. 직접 영향 요소
- **websocket/events/timer.js**: 수정 금지
- **websocket/events/index.js**: 최소 수정
- **views/*.ejs**: 기존 타이머 코드 유지

### 2. 간접 영향 요소
- **server.js**: WebSocket 설정 부분만 수정
- **models/index.js**: 새로운 모델 추가 시에만 수정
- **routes/*.js**: 새로운 API 추가 시에만 수정

### 3. 영향 없는 요소
- **기존 타이머 로직**: 완전히 보호
- **기존 WebSocket 이벤트**: 완전히 보호
- **기존 데이터베이스 구조**: 완전히 보호

## 📊 보호 수준 분석

### 1. 높은 보호 수준 (수정 금지)
- **핵심 변수**: `matchTimerData`, `pendingDbUpdates`
- **핵심 함수**: `startMatchTimer`, `stopMatchTimer`, `resetMatchTimer`, `setMatchTimer`
- **핵심 이벤트**: `timer_sync`, `request_timer_state`, `timer_control`

### 2. 중간 보호 수준 (최소 수정)
- **WebSocket 설정**: `websocket/events/index.js`
- **서버 설정**: `server.js`의 WebSocket 부분
- **모델 설정**: `models/index.js`의 새로운 모델 추가

### 3. 낮은 보호 수준 (자유 수정)
- **새로운 파일**: 완전히 새로운 파일들
- **새로운 기능**: 기존과 무관한 새로운 기능들
- **새로운 설정**: 기존과 무관한 새로운 설정들

## 🎯 보호 전략

### 1. 완전 격리 전략
- **독립적인 파일 구조**: 새로운 타이머 시스템을 완전히 별도 파일로 구현
- **독립적인 네임스페이스**: 모든 변수, 함수, 이벤트를 독립적으로 관리
- **독립적인 데이터베이스**: 새로운 DB 필드와 테이블 사용

### 2. 점진적 통합 전략
- **1단계**: 완전히 독립적인 시스템 구현
- **2단계**: 기존 시스템과의 호환성 테스트
- **3단계**: 선택적 통합 기능 구현
- **4단계**: 완전 통합 및 최적화

### 3. 롤백 전략
- **즉시 롤백**: 문제 발생 시 즉시 기존 시스템으로 롤백
- **데이터 보존**: 기존 데이터 완전 보존
- **설정 복원**: 기존 설정 완전 복원

## 📝 결론

기존 타이머 시스템은 다음과 같은 요소들로 완전히 보호되어야 합니다:

1. **핵심 변수**: `matchTimerData`, `pendingDbUpdates` 등
2. **핵심 함수**: `startMatchTimer`, `stopMatchTimer` 등
3. **핵심 이벤트**: `timer_sync`, `timer_control` 등
4. **핵심 데이터베이스**: 기존 DB 구조와 필드

새로운 타이머 시스템은 완전히 독립적으로 구현하여 기존 시스템과의 간섭을 완전히 방지해야 합니다.
