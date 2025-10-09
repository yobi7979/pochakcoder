# SportsCoder 프로젝트 구조

## ✅ **리팩토링 완료 상태 (2025-10-04)**

### **현재 프로젝트 상태**
- **서버**: `server_refactored_new.js` 정상 실행 중
- **라우터**: 9개 라우터 파일로 API 분리 완료
- **API**: 122개 엔드포인트 정상 작동
- **데이터베이스**: SQLite 정상 연결
- **WebSocket**: 정상 작동

### **주요 개선사항**
- **코드 중복 제거**: 200+ 줄 중복 코드 제거
- **라우터 구조 최적화**: 기능별 API 분리
- **유지보수성 향상**: 라우터별 관리로 개발 효율성 증대
- **문법 오류 해결**: 모든 라우터 파일 정상 작동

## 🚨 **라우터 통합 규칙 (2025-10-06 추가)**

### **API 호출 방식 표준화**
- **API 정의 위치**: 모든 API는 해당 라우터 파일에만 정의
- **server_refactored_new.js 역할**: 라우터 연결만 담당, 직접 API 정의 금지
- **라우터 연결 순서**: 구체적인 경로 우선, 일반적인 경로 후순위
- **API 호출 방식**: 모든 API를 라우터를 통해 호출하도록 통일

### **라우터 연결 순서 규칙**
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

### **점진적 통합 단계**
1. **1단계**: 핵심 API 이동 (/api/base-templates, /api/sport-overlay-images-with-active/:sportCode)
2. **2단계**: 오버레이 관련 API 이동
3. **3단계**: 기타 직접 정의된 API 이동
4. **4단계**: 라우터 연결 순서 최적화
5. **5단계**: API 호출 방식 표준화

## 📁 폴더 구조
```
C:\SportsCoder\
├── 📄 server.js                    # 메인 서버 애플리케이션
├── 📄 backup-restore.js            # 백업/복원 관리
├── 📄 database-setup.js            # 데이터베이스 연결 설정
├── 📄 models/                      # 데이터베이스 모델
│   ├── index.js                   # 모델 통합 및 연결
│   ├── User.js                    # 사용자 모델
│   ├── Template.js                # 템플릿 모델
│   ├── Match.js                   # 경기 모델
│   └── Sport.js                   # 스포츠 모델
├── 📄 public/js/                   # 프론트엔드 JavaScript
│   ├── animations.js              # 애니메이션 관리
│   ├── animation-controls.js      # 애니메이션 컨트롤
│   └── config.js                  # 클라이언트 설정
├── 📄 views/                       # EJS 템플릿
├── 📄 routes/                      # Express 라우터
├── 📄 middleware/                   # 미들웨어
├── 📄 utils/                       # 유틸리티 함수
├── 📄 config/                      # 설정 파일
├── 📄 backups/                     # 백업 파일 저장소
├── 📄 logs/                        # 로그 파일
├── 📄 temp_unused_files/           # 임시 파일 (사용하지 않는 파일들)
└── 📄 backup/                      # 롤백 시 생성된 임시 백업 폴더
```

## 📋 템플릿 파일명 규칙

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

## 🎯 핵심 기능

### 1. 서버 (server.js)
- Express.js 웹 서버
- Socket.IO 실시간 통신
- API 라우팅 및 미들웨어
- 세션 관리 및 인증

### 2. 데이터베이스 (models/)
- Sequelize ORM 사용
- SQLite (개발) / PostgreSQL (프로덕션)
- 사용자, 경기, 템플릿, 스포츠 모델

### 3. 백업 시스템 (backup-restore.js)
- 데이터베이스 전체 백업
- 파일 시스템 백업
- ZIP 압축 및 복원

### 4. 프론트엔드 (public/js/)
- 실시간 애니메이션
- 경기 오버레이 관리
- 사용자 인터페이스

## 📋 JavaScript 파일 분류

### 🎯 핵심 파일 (Core Files)
- `server.js` - 메인 서버
- `models/index.js` - 데이터베이스 연결
- `backup-restore.js` - 백업 관리

### 🗃️ 데이터베이스 모델 (Database Models)
- `models/User.js` - 사용자 관리
- `models/Template.js` - 템플릿 관리
- `models/Match.js` - 경기 관리
- `models/Sport.js` - 스포츠 관리

### 🛠️ 관리 스크립트 (Management Scripts)
- `setup.js` - 초기 설정
- `seed.js` - 데이터 시드
- `migrate-*.js` - 데이터베이스 마이그레이션
- `create-admin*.js` - 관리자 생성

### 🎨 프론트엔드 (Frontend)
- `public/js/animations.js` - 애니메이션
- `public/js/animation-controls.js` - 애니메이션 컨트롤
- `public/js/config.js` - 설정

## ⚠️ 중요 사항

### 삭제 금지 파일
- `server.js`
- `models/index.js`
- `backup-restore.js`
- `public/js/*.js`

### 임시 폴더
- `backup/` - 롤백 시 생성된 임시 폴더 (삭제 가능)
- `temp_unused_files/` - 사용하지 않는 파일들 (정리 가능)

### 백업 폴더
- `backups/` - 실제 백업 파일 저장소 (유지 필요)

## 🔧 개발 가이드

### 1. 서버 실행
```bash
node server.js
# 또는
npm start
```

### 2. 데이터베이스 초기화
```bash
node setup.js
node seed.js
```

### 3. 관리자 생성
```bash
node create-admin.js
```

### 4. 백업 생성
웹 인터페이스에서 "백업 생성" 기능 사용

## 📚 참고 문서
- `JAVASCRIPT_FILES_REFERENCE.md` - JavaScript 파일 역할 상세
- `.cursorrules` - Cursor AI 개발 규칙
- `PROJECT_STRUCTURE.md` - 프로젝트 구조 (이 파일)

---
*SportsCoder 프로젝트 구조 문서*
