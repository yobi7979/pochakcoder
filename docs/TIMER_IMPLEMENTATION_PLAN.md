# 타이머 시스템 구현 계획서

## 📋 프로젝트 개요

### 목표
- 기존 타이머 시스템을 유지하면서 새로운 타이머 기능을 선택적으로 추가
- 기존 타이머와 새로운 타이머 시스템이 서로 간섭 없이 작동
- 안전한 구현을 통한 시스템 안정성 보장

### 핵심 원칙
1. **기존 시스템 보호**: 현재 타이머 시스템을 그대로 유지
2. **격리된 구현**: 새로운 타이머 시스템을 독립적으로 구현
3. **선택적 적용**: 필요에 따라 새로운 타이머 시스템 선택 적용
4. **안전한 전환**: 기존 시스템에 영향 없이 안전한 전환

## 🔍 현재 시스템 분석

### 기존 타이머 시스템 구조
```
websocket/events/
├── timer.js (기존 - 372줄)
└── index.js (기존 - 28줄)

views/
├── soccer-control.ejs (기존 타이머 코드 포함)
├── soccer-template.ejs (기존 타이머 코드 포함)
├── baseball-control.ejs (기존 타이머 코드 포함)
└── baseball-template.ejs (기존 타이머 코드 포함)
```

### 기존 타이머 시스템 특징
- **메모리 기반**: `matchTimerData` Map 사용
- **WebSocket 이벤트**: `timer_control`, `timer_sync`, `timer_state`
- **하이브리드 방식**: 서버 시간 + 로컬 시간 결합
- **DB 배치 업데이트**: 5초마다 배치로 DB 업데이트

## 🎯 새로운 타이머 시스템 설계

### 1. 서버 중심 타이머 시스템 (Server-Centric)
```
websocket/events/
├── timer-server-centric.js (신규)
├── timer-mode-manager.js (신규)
└ timer-config.js (신규)
```

**특징:**
- 서버가 모든 타이머 상태 관리
- 클라이언트는 서버 상태 동기화만 담당
- 완벽한 동기화 보장
- 시간대 독립적 동작

### 2. 하이브리드 타이머 시스템 (Hybrid)
```
websocket/events/
├── timer-hybrid.js (신규)
├── timer-sync-manager.js (신규)
└── timer-recovery.js (신규)
```

**특징:**
- 서버 연결 시 서버 중심 동작
- 서버 중단 시 로컬 타이머로 전환
- 서버 복구 시 자동 동기화
- 최적의 안정성 보장

## 🛡️ 안전한 구현 방안

### 1. 기존 시스템 보호 방안

#### A. 네임스페이스 격리
```javascript
// 기존 타이머 시스템
const existingTimer = {
    matchTimerData: new Map(),
    startMatchTimer: function(matchId) { /* 기존 로직 */ },
    stopMatchTimer: function(matchId) { /* 기존 로직 */ }
};

// 새로운 타이머 시스템
const newTimer = {
    serverCentric: new ServerCentricTimer(),
    hybrid: new HybridTimer(),
    modeManager: new TimerModeManager()
};
```

#### B. 이벤트 격리
```javascript
// 기존 이벤트 (유지)
socket.on('timer_control', existingTimerHandler);
socket.on('timer_sync', existingTimerHandler);
socket.on('timer_state', existingTimerHandler);

// 새로운 이벤트 (별도 네임스페이스)
socket.on('timer_v2_control', newTimerHandler);
socket.on('timer_v2_sync', newTimerHandler);
socket.on('timer_v2_state', newTimerHandler);
```

#### C. 데이터 격리
```javascript
// 기존 데이터 (유지)
const matchTimerData = new Map(); // 기존 변수명 유지

// 새로운 데이터 (별도 변수명)
const serverCentricTimerData = new Map();
const hybridTimerData = new Map();
const timerModeData = new Map();
```

### 2. 새로운 시스템 격리 방안

#### A. 독립적인 파일 구조
```
websocket/events/
├── timer.js (기존 - 수정 금지)
├── timer-v2/ (신규 - 새로운 타이머 시스템)
│   ├── server-centric.js
│   ├── hybrid.js
│   ├── mode-manager.js
│   └── index.js
└── index.js (기존 - 수정 최소화)
```

#### B. 독립적인 클래스 구조
```javascript
// 새로운 타이머 시스템 클래스
class ServerCentricTimer {
    constructor() {
        this.timerData = new Map();
        this.isActive = false;
    }
    
    // 기존 시스템과 완전히 독립적인 메서드들
    startTimer(matchId) { /* 새로운 로직 */ }
    stopTimer(matchId) { /* 새로운 로직 */ }
    getCurrentTime(matchId) { /* 새로운 로직 */ }
}

class HybridTimer {
    constructor() {
        this.serverTimer = new ServerTimer();
        this.localTimer = new LocalTimer();
        this.isActive = false;
    }
    
    // 기존 시스템과 완전히 독립적인 메서드들
    startTimer(matchId) { /* 새로운 로직 */ }
    stopTimer(matchId) { /* 새로운 로직 */ }
    getCurrentTime(matchId) { /* 새로운 로직 */ }
}
```

#### C. 독립적인 WebSocket 이벤트
```javascript
// 새로운 타이머 시스템 이벤트 (기존과 완전히 분리)
const newTimerEvents = (socket, io) => {
    // 새로운 이벤트 핸들러들
    socket.on('timer_v2_control', handleNewTimerControl);
    socket.on('timer_v2_sync', handleNewTimerSync);
    socket.on('timer_v2_state', handleNewTimerState);
    socket.on('timer_v2_mode_switch', handleModeSwitch);
};
```

## 📋 단계별 구현 계획

### 1단계: 기존 시스템 보호 및 분석 (1주)
- [ ] 기존 타이머 시스템 완전 분석
- [ ] 기존 시스템 영향도 분석
- [ ] 보호 방안 수립
- [ ] 테스트 환경 구축

### 2단계: 새로운 시스템 기본 구조 구현 (1주)
- [ ] 새로운 타이머 시스템 기본 구조
- [ ] 독립적인 파일 구조 생성
- [ ] 기본 클래스 및 인터페이스 구현
- [ ] 단위 테스트 작성

### 3단계: 서버 중심 타이머 시스템 구현 (2주)
- [ ] ServerCentricTimer 클래스 구현
- [ ] WebSocket 이벤트 처리 구현
- [ ] 데이터베이스 연동 구현
- [ ] 단위 테스트 및 통합 테스트

### 4단계: 하이브리드 타이머 시스템 구현 (2주)
- [ ] HybridTimer 클래스 구현
- [ ] 서버-로컬 타이머 동기화 구현
- [ ] 오프라인 지원 구현
- [ ] 단위 테스트 및 통합 테스트

### 5단계: 모드 전환 시스템 구현 (1주)
- [ ] TimerModeManager 클래스 구현
- [ ] 런타임 모드 전환 기능
- [ ] 설정 관리 시스템
- [ ] 단위 테스트 및 통합 테스트

### 6단계: 통합 테스트 및 검증 (1주)
- [ ] 기존 시스템과의 호환성 테스트
- [ ] 새로운 시스템 간섭 테스트
- [ ] 성능 테스트
- [ ] 사용자 테스트

## 🧪 테스트 및 검증 계획

### 1. 단위 테스트
- [ ] 각 타이머 시스템 독립 테스트
- [ ] 메서드별 기능 테스트
- [ ] 에러 처리 테스트
- [ ] 경계값 테스트

### 2. 통합 테스트
- [ ] 기존 시스템과 새로운 시스템 동시 실행 테스트
- [ ] WebSocket 이벤트 충돌 테스트
- [ ] 데이터베이스 동시 접근 테스트
- [ ] 메모리 사용량 테스트

### 3. 성능 테스트
- [ ] 단일 경기 타이머 성능 테스트
- [ ] 다중 경기 타이머 성능 테스트
- [ ] 서버 부하 테스트
- [ ] 메모리 누수 테스트

### 4. 호환성 테스트
- [ ] 기존 API 호환성 테스트
- [ ] 기존 클라이언트 호환성 테스트
- [ ] 기존 데이터 호환성 테스트
- [ ] 브라우저 호환성 테스트

## 🚨 위험 요소 및 대응 방안

### 1. 기존 시스템 간섭 위험
**위험 요소:**
- 새로운 타이머 시스템이 기존 시스템에 영향
- WebSocket 이벤트 충돌
- 데이터베이스 동시 접근 충돌

**대응 방안:**
- 완전한 네임스페이스 격리
- 독립적인 이벤트 핸들러
- 데이터베이스 트랜잭션 격리

### 2. 성능 저하 위험
**위험 요소:**
- 새로운 타이머 시스템으로 인한 성능 저하
- 메모리 사용량 증가
- CPU 사용량 증가

**대응 방안:**
- 선택적 로딩 (필요한 시스템만 로딩)
- 메모리 사용량 모니터링
- 성능 최적화

### 3. 데이터 손실 위험
**위험 요소:**
- 새로운 시스템으로 인한 기존 데이터 손실
- 타이머 상태 불일치
- 동기화 실패

**대응 방안:**
- 기존 데이터 백업
- 점진적 마이그레이션
- 롤백 계획 수립

## 📊 모니터링 및 관리

### 1. 실시간 모니터링
- [ ] 타이머 시스템 상태 모니터링
- [ ] 메모리 사용량 모니터링
- [ ] CPU 사용량 모니터링
- [ ] 네트워크 트래픽 모니터링

### 2. 로깅 시스템
- [ ] 타이머 시스템별 로깅
- [ ] 에러 로깅
- [ ] 성능 로깅
- [ ] 사용자 행동 로깅

### 3. 알림 시스템
- [ ] 시스템 장애 알림
- [ ] 성능 저하 알림
- [ ] 에러 발생 알림
- [ ] 사용자 피드백 알림

## 🎯 성공 기준

### 1. 기능적 성공 기준
- [ ] 기존 타이머 시스템 정상 작동
- [ ] 새로운 타이머 시스템 정상 작동
- [ ] 두 시스템 간 간섭 없음
- [ ] 모드 전환 기능 정상 작동

### 2. 성능적 성공 기준
- [ ] 기존 시스템 성능 유지
- [ ] 새로운 시스템 성능 기준 달성
- [ ] 메모리 사용량 증가 < 20%
- [ ] CPU 사용량 증가 < 15%

### 3. 안정성 성공 기준
- [ ] 시스템 장애율 < 0.1%
- [ ] 데이터 손실 없음
- [ ] 타이머 정확도 > 99.9%
- [ ] 동기화 성공률 > 99.5%

## 📅 일정 및 마일스톤

### 전체 일정: 8주
- **1주차**: 기존 시스템 보호 및 분석
- **2주차**: 새로운 시스템 기본 구조 구현
- **3-4주차**: 서버 중심 타이머 시스템 구현
- **5-6주차**: 하이브리드 타이머 시스템 구현
- **7주차**: 모드 전환 시스템 구현
- **8주차**: 통합 테스트 및 검증

### 주요 마일스톤
- **M1**: 기존 시스템 보호 완료
- **M2**: 새로운 시스템 기본 구조 완료
- **M3**: 서버 중심 타이머 시스템 완료
- **M4**: 하이브리드 타이머 시스템 완료
- **M5**: 모드 전환 시스템 완료
- **M6**: 통합 테스트 및 검증 완료

## 📝 결론

이 계획서는 기존 타이머 시스템을 보호하면서 새로운 타이머 기능을 안전하게 추가하는 것을 목표로 합니다. 

**핵심 원칙:**
1. **기존 시스템 보호**: 현재 시스템을 그대로 유지
2. **격리된 구현**: 새로운 시스템을 독립적으로 구현
3. **선택적 적용**: 필요에 따라 새로운 시스템 선택 적용
4. **안전한 전환**: 기존 시스템에 영향 없이 안전한 전환

**성공을 위한 핵심 요소:**
- 철저한 분석과 계획
- 단계별 안전한 구현
- 지속적인 테스트와 검증
- 기존 시스템과의 완전한 격리

이 계획에 따라 단계별로 진행하면서 각 단계마다 철저한 테스트와 검증을 통해 안전한 구현을 보장하겠습니다.
