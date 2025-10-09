# SportsCoder 리팩토링 계획서

## 📁 템플릿 파일명 규칙

### 템플릿 파일 구조
각 템플릿은 3개의 파일로 구성되며, 다음 명명 규칙을 따릅니다:

```
템플릿이름-template.ejs      # 메인 템플릿 파일
템플릿이름-control.ejs       # 데스크톱 컨트롤 파일  
템플릿이름-control-mobile.ejs # 모바일 컨트롤 파일
```

### 예시
- **축구 템플릿**: `soccer-template.ejs`, `soccer-control.ejs`, `soccer-control-mobile.ejs`
- **야구 템플릿**: `baseball-template.ejs`, `baseball-control.ejs`, `baseball-control-mobile.ejs`
- **사용자 템플릿**: `asdf-template.ejs`, `asdf-control.ejs`, `asdf-control-mobile.ejs`

### 파일 위치
- **기본 템플릿**: `views/` 폴더에 저장
- **사용자 생성 템플릿**: `views/` 폴더에 저장
- **확장자**: 모든 템플릿 파일은 `.ejs` 확장자 사용

## 📋 현재 상황 분석

### 문제점
- **server.js**: 8,119줄의 거대한 단일 파일
- **122개 API 엔드포인트**가 하나의 파일에 집중
- **유지보수성 저하**: 코드 수정 시 긴 파일 스크롤 필요
- **협업 어려움**: 여러 개발자 동시 작업 시 충돌 위험

### 🚨 새로 발견된 심각한 문제점 (2025-10-04)
- **라우터 연결 순서 문제**: `app.use('/api', overlaysRouter)`가 모든 API를 가로챔
- **중복 라우터 연결**: 동일한 라우터가 여러 번 연결됨
- **API 중복 정의**: server_refactored_new.js에 117개 직접 정의 API + 라우터 API 중복
- **라우트 매칭 충돌**: 경기 삭제 404 오류의 근본 원인

### 현재 구조
```
server_refactored_new.js (2,800+줄)
├── 라우터 연결 (17개, 중복 포함)
├── 직접 정의 API (117개)
├── 중복 API (41개)
└── 충돌 라우트 (여러 개)

routes/ (11개 라우터 파일)
├── auth.js (4개 API)
├── backup.js (5개 API)
├── db-management.js (10개 API)
├── logs.js (9개 API)
├── match-lists.js (8개 API)
├── matches.js (22개 API)
├── overlays.js (25개 API)
├── settings.js (8개 API)
├── sports.js (6개 API)
├── templates.js (5개 API)
└── users.js (5개 API)
```

### 🚨 라우터 연결 순서 문제
```javascript
// 현재 문제가 있는 연결 순서
app.use('/api', overlaysRouter);        // 🚨 모든 /api/* 요청을 가로챔
app.use('/api/matches', matchesRouter); // 위에서 이미 가로채짐
app.use('/api/users', usersRouter);     // 위에서 이미 가로채짐
```

## 🎯 리팩토링 목표

### 1. 모듈화
- 기능별로 파일 분리
- 재사용 가능한 컴포넌트 생성
- 의존성 최소화

### 2. 유지보수성 향상
- 특정 기능 수정 시 해당 파일만 수정

### 3. 🚨 긴급: 라우터 구조 정리 (최우선)
- 라우터 연결 순서 재정렬
- 중복 라우터 제거
- API 중복 정의 해결
- 라우트 매칭 충돌 해결

## 🚨 새로운 개발 규칙 (2025-10-04 추가)

### 라우터 연결 규칙
1. **구체적인 경로 우선**: `/api/specific-route`를 `/api`보다 먼저 배치
2. **중복 라우터 금지**: 동일한 라우터를 여러 번 연결하지 않음
3. **광범위한 매칭 금지**: `app.use('/api', router)` 사용 금지
4. **라우터 우선 원칙**: server.js에 직접 API 정의보다 라우터 사용 우선

### API 정의 규칙
1. **라우터 우선**: 모든 API는 해당 라우터에 정의
2. **중복 API 금지**: server.js와 라우터에 동일한 API 정의 금지
3. **일관성 유지**: 동일한 기능의 API는 하나의 위치에만 정의

### 라우터 연결 순서 (권장)
```javascript
// 1. 인증 (루트 경로)
app.use('/', authRouter);

// 2. 구체적인 API 경로들 (우선순위 순)
app.use('/api/sport-management', dbManagementRouter);
app.use('/api/users', usersRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/sport', sportsRouter);
app.use('/api/overlay-images', overlaysRouter);
app.use('/api/backup', backupRouter);
app.use('/api/logs', logsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/match-lists', matchListsRouter);

// 3. 페이지 라우트
app.use('/list', matchListsRouter);
app.use('/unified', matchListsRouter);
app.use('/db-management', dbManagementRouter);
```

## 🚨 안전한 리팩토링 작업 규칙 (2025-10-04 추가)

### 작업 전 필수 사항
1. **🚨 라우터 우선 확인 (최우선)** - 새롭게 추가되거나 수정해야 하는 부분은 항상 해당 라우터를 먼저 확인
   - **API 추가/수정 시: 반드시 해당 라우터 파일 먼저 확인**
   - **server_refactored_new.js에 API 직접 작성 절대 금지**
   - **기능별 라우터: routes/sports.js, routes/templates.js, routes/matches.js, routes/match-lists.js, routes/users.js, routes/auth.js, routes/overlays.js, routes/backup.js, routes/logs.js**
   - **라우터에 추가 후 server_refactored_new.js에서 연결만 허용**
   - **규칙 위반 시 즉시 수정 요구**
2. **🚨 WebSocket 우선 확인 (최우선)** - WebSocket 관련 코드 작성/수정 시 websocket/ 폴더 우선 확인
   - WebSocket 이벤트 추가/수정 시: websocket/events/ 폴더의 해당 파일 먼저 확인
   - WebSocket 연결 처리: websocket/connection.js
   - WebSocket 이벤트 설정: websocket/events/index.js
   - WebSocket 유틸리티: websocket/utils/
   - WebSocket 미들웨어: websocket/middleware/
   - server_refactored_new.js에 WebSocket 코드 직접 작성 금지 - websocket/ 폴더에 추가 후 연결만 허용
3. **🚨 라우터 통합 규칙 (최우선)** - API 호출 방식 표준화 및 라우터 구조 통합
   - **API 정의 위치**: 모든 API는 해당 라우터 파일에만 정의
   - **server_refactored_new.js 직접 API 정의 금지**: 라우터 연결만 허용
   - **라우터 연결 순서**: 구체적인 경로 우선, 일반적인 경로 후순위
   - **API 호출 방식**: 모든 API를 라우터를 통해 호출하도록 통일
   - **점진적 통합**: 직접 정의된 API를 단계별로 라우터로 이동
   - **규칙 위반 시 즉시 수정 요구**
4. **현재 상태 백업**: 수정 전 반드시 전체 프로젝트 백업
5. **기능 테스트**: 현재 작동하는 모든 기능 확인 및 기록
6. **단계별 검증**: 각 단계마다 전체 기능 테스트
7. **롤백 준비**: 문제 발생 시 즉시 이전 상태로 복원

### 작업 진행 방식
1. **1단계씩 진행**: 한 번에 모든 것을 수정하지 않음
2. **기능별 검증**: 각 기능을 직접 실행하여 문제 없는지 확인
3. **점진적 적용**: 작은 단위로 나누어 수정
4. **충분한 테스트**: 각 단계에서 모든 기능이 정상 작동하는지 확인

### 검증 체크리스트
- [ ] 서버 시작/종료 정상
- [ ] 로그인/로그아웃 기능
- [ ] 경기 생성/수정/삭제 기능
- [ ] 오버레이 페이지 표시
- [ ] 실시간 업데이트 기능
- [ ] 파일 업로드/다운로드 기능
- [ ] 데이터베이스 연결
- [ ] WebSocket 연결

### 문제 발생 시 대응
1. **즉시 중단**: 문제 발견 시 즉시 작업 중단
2. **롤백 실행**: 이전 상태로 즉시 복원
3. **원인 분석**: 문제 원인 파악 후 해결 방안 모색
4. **재시도**: 문제 해결 후 안전한 방법으로 재시도

## 🚨 라우터 통합 규칙 (2025-10-06 추가)

### 라우터 통합 원칙
1. **API 정의 위치**: 모든 API는 해당 라우터 파일에만 정의
2. **server_refactored_new.js 역할**: 라우터 연결만 담당, 직접 API 정의 금지
3. **라우터 연결 순서**: 구체적인 경로 우선, 일반적인 경로 후순위
4. **API 호출 방식**: 모든 API를 라우터를 통해 호출하도록 통일

### 라우터 연결 순서 규칙
```javascript
// 1. 구체적인 API 라우터들 (우선순위 높음)
app.use('/api/templates', templatesRouter);
app.use('/api/sport', sportsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/users', usersRouter);
app.use('/api/backup', backupRouter);
app.use('/api/logs', logsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/match-lists', matchListsRouter);

// 2. 오버레이 API 라우터 (최후순위 - /api/* 패턴)
app.use('/api', overlaysRouter);
```

### API 이동 규칙
1. **직접 정의된 API 식별**: server_refactored_new.js의 직접 정의된 API 목록 작성
2. **해당 라우터 결정**: API 기능에 따라 적절한 라우터 파일 선택
3. **API 코드 이동**: 직접 정의된 API를 해당 라우터로 이동
4. **server_refactored_new.js에서 제거**: 이동된 API 코드 삭제
5. **테스트 및 검증**: API 이동 후 정상 작동 확인

### 점진적 통합 단계
1. **1단계**: 핵심 API 이동 (/api/base-templates, /api/sport-overlay-images-with-active/:sportCode)
2. **2단계**: 오버레이 관련 API 이동
3. **3단계**: 기타 직접 정의된 API 이동
4. **4단계**: 라우터 연결 순서 최적화
5. **5단계**: API 호출 방식 표준화

### 금지사항
- **server_refactored_new.js에 직접 API 정의 금지**
- **라우터 연결 순서 무시 금지**
- **API 중복 정의 금지**
- **라우터 없이 API 호출 금지**

## 🚨 **단계별 라우터 통합 진행 규칙 (2025-10-06 추가)**

### **단계별 진행 원칙**
1. **1단계씩 진행**: 한 번에 모든 것을 수정하지 않음
2. **API 호출 테스트 필수**: 각 단계마다 API 호출 정상 작동 확인
3. **연결 문제 확인**: API 연결에 문제가 없는지 직접 테스트
4. **롤백 준비**: 문제 발생 시 즉시 이전 상태로 복원

### **각 단계별 필수 확인사항**
1. **API 이동 후 테스트**: 이동된 API가 정상 작동하는지 확인
2. **클라이언트 API 호출 테스트**: 클라이언트에서 API 호출이 정상 작동하는지 확인
3. **라우터 연결 테스트**: 라우터 연결이 정상 작동하는지 확인
4. **전체 기능 테스트**: 모든 기능이 정상 작동하는지 확인

### **단계별 진행 순서**
1. **1단계**: 핵심 API 이동 및 클라이언트 수정
2. **2단계**: 오버레이 관련 API 이동 및 클라이언트 수정
3. **3단계**: 기타 직접 정의된 API 이동 및 클라이언트 수정
4. **4단계**: 라우터 연결 순서 최적화
5. **5단계**: API 호출 방식 표준화

### **각 단계별 테스트 체크리스트**
- [ ] 서버 시작/종료 정상
- [ ] API 엔드포인트 정상 작동
- [ ] 클라이언트 API 호출 정상 작동
- [ ] 라우터 연결 정상 작동
- [ ] 전체 기능 정상 작동
- [ ] 문제 발생 시 롤백 준비

## 🔄 실시간 업데이트 개발 표준

### DB 저장 형태의 코드 작성 시 실시간 업데이트 방법

#### 1. 컨트롤 페이지 (Control Page) 작성 규칙
```javascript
// ❌ 기존 방식 (복잡한 소켓 이벤트)
socket.emit('specificDataUpdated', {
    matchId: matchId,
    specificData: data,
    additionalInfo: info
});

// ✅ 새로운 방식 (단순한 DB 변경 알림)
socket.emit('dataChanged', {
    matchId: matchId,
    type: 'dataType',  // 예: 'teamColor', 'teamLogo', 'score', 'timer'
    teamType: teamType  // 필요한 경우만
});
```

#### 2. 오버레이 페이지 (Template Page) 작성 규칙
```javascript
// ❌ 기존 방식 (복잡한 이벤트별 처리)
socket.on('specificDataUpdated', function(data) {
    // 특정 데이터만 업데이트
    updateSpecificData(data);
});

// ✅ 새로운 방식 (DB에서 최신 데이터 로드)
socket.on('dataChanged', async function(data) {
    if (data.matchId === matchId) {
        // DB에서 최신 데이터 로드
        await loadLatestDataFromDB();
        // UI 업데이트
        updateUI();
    }
});
```

#### 3. 개발 시 체크리스트
- [ ] DB에 저장하는 API가 있는가?
- [ ] 오버레이 페이지에서 실시간 업데이트가 필요한가?
- [ ] 컨트롤 페이지에서 `dataChanged` 이벤트를 보내는가?
- [ ] 오버레이 페이지에서 `dataChanged` 이벤트를 받아 DB에서 데이터를 로드하는가?

#### 4. 표준 패턴
```javascript
// 컨트롤 페이지 패턴
async function saveDataToDB(data) {
    // 1. DB에 저장
    const response = await fetch('/api/endpoint', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (response.ok) {
        // 2. 소켓 이벤트로 변경 알림
        socket.emit('dataChanged', {
            matchId: matchId,
            type: 'dataType'
        });
    }
}

// 오버레이 페이지 패턴
socket.on('dataChanged', async function(data) {
    if (data.matchId === matchId) {
        await loadDataFromDB();
        updateUI();
    }
});
```
- 코드 가독성 향상
- 버그 추적 용이

### 3. 확장성 확보
- 새로운 기능 추가 시 새 모듈만 생성
- 팀원별 모듈 담당 가능
- 마이크로서비스 전환 준비

## 📁 제안하는 새로운 구조

```
server.js (메인 진입점, ~100줄)
├── config/
│   ├── database.js          # DB 설정
│   ├── session.js           # 세션 설정
│   └── app.js               # 앱 설정
├── middleware/
│   ├── auth.js              # 인증 미들웨어
│   ├── validation.js        # 데이터 검증
│   ├── logging.js           # 로깅 미들웨어
│   └── errorHandler.js      # 에러 처리
├── routes/
│   ├── index.js             # 라우터 통합
│   ├── auth.js              # 인증 라우트
│   ├── matches.js           # 경기 관리 라우트
│   ├── users.js             # 사용자 관리 라우트
│   ├── templates.js         # 템플릿 관리 라우트
│   ├── sports.js            # 종목 관리 라우트
│   ├── overlays.js          # 오버레이 라우트
│   ├── backup.js            # 백업/복원 라우트
│   └── logs.js              # 로그 관리 라우트
├── controllers/
│   ├── MatchController.js   # 경기 비즈니스 로직
│   ├── UserController.js    # 사용자 비즈니스 로직
│   ├── TemplateController.js # 템플릿 비즈니스 로직
│   ├── SportController.js   # 종목 비즈니스 로직
│   ├── OverlayController.js # 오버레이 비즈니스 로직
│   ├── BackupController.js  # 백업 비즈니스 로직
│   └── LogController.js     # 로그 비즈니스 로직
├── services/
│   ├── MatchService.js      # 경기 서비스 로직
│   ├── UserService.js       # 사용자 서비스 로직
│   ├── TemplateService.js  # 템플릿 서비스 로직
│   ├── SportService.js      # 종목 서비스 로직
│   ├── OverlayService.js    # 오버레이 서비스 로직
│   ├── BackupService.js     # 백업 서비스 로직
│   └── LogService.js        # 로그 서비스 로직
└── utils/
    ├── helpers.js           # 공통 유틸리티
    ├── validators.js         # 데이터 검증
    └── constants.js         # 상수 정의
```

## 🚀 단계별 마이그레이션 전략

### Phase 1: 기반 구조 설정 (1주)
1. **폴더 구조 생성**
   - `config/`, `middleware/`, `routes/`, `controllers/`, `services/`, `utils/` 폴더 생성
   
2. **설정 파일 분리**
   - `config/database.js` - DB 설정
   - `config/session.js` - 세션 설정
   - `config/app.js` - 앱 설정

3. **미들웨어 분리**
   - `middleware/auth.js` - 인증 미들웨어
   - `middleware/errorHandler.js` - 에러 핸들러
   - `middleware/logging.js` - 로깅 미들웨어

### Phase 2: 라우터 분리 (2주)
1. **핵심 라우터 분리**
   - `routes/matches.js` - 경기 관리 (15개 API)
   - `routes/users.js` - 사용자 관리 (8개 API)
   - `routes/auth.js` - 인증 (3개 API)

2. **기능별 라우터 분리**
   - `routes/templates.js` - 템플릿 관리 (8개 API)
   - `routes/sports.js` - 종목 관리 (5개 API)
   - `routes/overlays.js` - 오버레이 (12개 API)

3. **유틸리티 라우터 분리**
   - `routes/backup.js` - 백업/복원 (5개 API)
   - `routes/logs.js` - 로그 관리 (8개 API)

### Phase 3: 컨트롤러 분리 (2주)
1. **비즈니스 로직 분리**
   - 각 라우터의 핸들러 함수를 컨트롤러로 이동
   - 데이터베이스 조작 로직을 서비스 레이어로 이동

2. **공통 로직 추출**
   - 반복되는 코드를 유틸리티 함수로 추출
   - 에러 처리 표준화

### Phase 4: 서비스 레이어 구축 (1주)
1. **데이터 액세스 분리**
   - 데이터베이스 조작을 서비스 레이어로 이동
   - 비즈니스 로직과 데이터 액세스 분리

2. **공통 서비스 구축**
   - 파일 업로드 서비스
   - 이메일 발송 서비스
   - 로깅 서비스

### Phase 5: 테스트 및 최적화 (1주)
1. **기능 테스트**
   - 모든 API 엔드포인트 동작 확인
   - 프론트엔드 연동 테스트

2. **성능 최적화**
   - 불필요한 의존성 제거
   - 메모리 사용량 최적화

## ⚠️ 리팩토링 시 주의사항

### 1. 호환성 유지
- **API 엔드포인트 URL 변경 금지**
- **요청/응답 형식 변경 금지**
- **프론트엔드 코드 수정 최소화**

### 2. 점진적 마이그레이션
- **한 번에 모든 것을 바꾸지 않음**
- **기존 코드와 새 코드 공존**
- **단계별 검증 후 다음 단계 진행**

### 3. 의존성 관리
- **순환 의존성 방지**
- **모듈 간 결합도 최소화**
- **인터페이스 표준화**

### 4. 테스트 코드
- **리팩토링 전후 동일한 동작 보장**
- **각 모듈별 단위 테스트 작성**
- **통합 테스트 수행**

## 📊 예상 효과

### 개발 생산성
- **코드 수정 시간 50% 단축**
- **버그 추적 시간 70% 단축**
- **새 기능 개발 시간 40% 단축**

### 유지보수성
- **특정 기능 수정 시 해당 파일만 수정**
- **코드 리뷰 시간 60% 단축**
- **신규 개발자 온보딩 시간 50% 단축**

### 협업 효율성
- **팀원별 모듈 담당 가능**
- **병렬 개발 가능**
- **Git 충돌 80% 감소**

## 🎯 성공 지표

### 정량적 지표
- **파일당 평균 라인 수**: 8,119줄 → 200줄 이하
- **모듈 수**: 1개 → 20개 이상
- **의존성 수**: 27개 → 10개 이하

### 정성적 지표
- **코드 가독성 향상**
- **유지보수성 향상**
- **확장성 확보**
- **협업 효율성 향상**

## 📅 일정표

| 주차 | 작업 내용 | 예상 소요시간 | 담당자 |
|------|-----------|---------------|--------|
| 1주 | 기반 구조 설정 | 40시간 | 백엔드 개발자 |
| 2주 | 라우터 분리 | 80시간 | 백엔드 개발자 |
| 3주 | 컨트롤러 분리 | 80시간 | 백엔드 개발자 |
| 4주 | 서비스 레이어 구축 | 40시간 | 백엔드 개발자 |
| 5주 | 테스트 및 최적화 | 40시간 | 전체 개발팀 |

**총 예상 소요시간: 280시간 (7주)**

## ✅ **리팩토링 완료 상태 (2025-10-04)**

### **완료된 단계**
- ✅ **Phase 1**: 라우터 연결 순서 및 충돌 해결
- ✅ **Phase 2**: 중복 API 제거
- ✅ **Phase 3**: 라우터 내부 세부 최적화
- ✅ **Phase 4**: 문서화 및 정리

### **현재 상태**
- **서버**: 정상 실행 중 (포트 3000)
- **데이터베이스**: SQLite 정상 연결
- **WebSocket**: 정상 작동
- **API**: 122개 엔드포인트 정상 작동
- **라우터**: 9개 라우터 파일로 분리 완료

### **주요 성과**
- **코드 중복 제거**: 200+ 줄 중복 코드 제거
- **라우터 구조 최적화**: 9개 라우터로 API 분리
- **문법 오류 해결**: 모든 라우터 파일 정상 작동
- **유지보수성 향상**: 라우터별 관리로 개발 효율성 증대

### **다음 단계 권장사항**
1. **Phase 5**: 성능 최적화 (데이터베이스 쿼리 최적화, 캐싱 시스템)
2. **추가 개발**: 새로운 기능 개발, UI/UX 개선
3. **모니터링**: 시스템 안정성 지속적 모니터링
