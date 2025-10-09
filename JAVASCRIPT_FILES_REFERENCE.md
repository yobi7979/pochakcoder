# SportsCoder 프로젝트 JavaScript 파일 구조 및 역할

## 📋 개요
이 문서는 SportsCoder 프로젝트의 모든 JavaScript 파일들의 역할과 의존성을 정리한 참고 문서입니다.

## 🔄 실시간 업데이트 개발 룰
**DB 저장 형태의 코드 작성 시 실시간 업데이트가 필요한 경우, 다음 룰을 참고하세요:**
- **룰 문서**: `REALTIME_UPDATE_RULES.md`
- **개발 계획서**: `REFACTORING_PLAN.md`의 "실시간 업데이트 개발 표준" 섹션
- **핵심 원칙**: 복잡한 소켓 이벤트 대신 단순한 `dataChanged` 이벤트 사용
- **데이터 일관성**: DB에서 직접 최신 데이터 로드하여 보장

## 🎯 1. 핵심 서버 파일 (Core Server)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`server.js`** | 메인 서버 애플리케이션 | Express 서버, Socket.IO, API 라우팅, 전체 애플리케이션 진입점 | models/index.js, backup-restore.js |

## 🗃️ 2. 데이터베이스 모델 (Database Models)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`models/index.js`** | 데이터베이스 연결 및 모델 통합 | Sequelize 설정, 모든 모델 정의 및 관계 설정 | - |
| **`models/User.js`** | 사용자 모델 | 사용자 인증, 권한 관리, 사용자 정보 | models/index.js |
| **`models/Template.js`** | 템플릿 모델 | 오버레이 템플릿 관리 | models/index.js |
| **`models/Match.js`** | 경기 모델 | 경기 데이터 구조 및 관리 | models/index.js |
| **`models/Sport.js`** | 스포츠 모델 | 스포츠 종목 데이터 관리 | models/index.js |

## 🔧 3. 데이터베이스 관리 (Database Management)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`database-setup.js`** | 데이터베이스 연결 설정 | SQLite/PostgreSQL 연결 설정 | - |
| **`migrate-database.js`** | 데이터베이스 마이그레이션 | 테이블 구조 업데이트, 스키마 변경 | models/index.js |
| **`migrate-to-postgres.js`** | PostgreSQL 마이그레이션 | SQLite → PostgreSQL 전환 | database-setup.js |
| **`migrate-user-sport-permissions.js`** | 사용자 권한 마이그레이션 | 사용자 스포츠 권한 데이터 마이그레이션 | models/index.js |

## 🛠️ 4. 데이터 관리 스크립트 (Data Management Scripts)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`seed.js`** | 데이터베이스 시드 | 초기 데이터 삽입, 기본 데이터 생성 | models/index.js |
| **`setup.js`** | 초기 설정 | 데이터베이스 초기화, 기본 설정 | models/index.js |
| **`generate-matches.js`** | 경기 데이터 생성 | 테스트용 경기 데이터 대량 생성 | database-setup.js |
| **`start-all-matches.js`** | 경기 일괄 시작 | 모든 경기 타이머 시작 및 오버레이 열기 | socket.io-client |
| **`reset-all-matches.js`** | 경기 일괄 리셋 | 모든 경기 데이터 초기화 | socket.io-client |
| **`randomize-match-times.js`** | 경기 시간 랜덤화 | 경기 시간 랜덤 설정 | socket.io-client |

## 👥 5. 사용자 관리 (User Management)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`create-admin.js`** | 관리자 계정 생성 | 관리자 사용자 생성 | models/index.js |
| **`create-admin-user.js`** | 관리자 사용자 생성 | 관리자 계정 생성 도구 | models/index.js |
| **`check-password.js`** | 비밀번호 확인 | 사용자 비밀번호 검증 | models/index.js |

## 💾 6. 백업 및 복원 (Backup & Restore)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`backup-restore.js`** | 백업/복원 관리자 | 데이터베이스 백업, 복원, ZIP 파일 관리 | models/index.js, archiver, unzipper |

## 🎨 7. 프론트엔드 JavaScript (Frontend JS)

| 파일명 | 역할 | 설명 | 의존성 |
|--------|------|------|--------|
| **`public/js/animations.js`** | 애니메이션 관리자 | 축구 경기 오버레이 애니메이션 제어 | - |
| **`public/js/animation-controls.js`** | 애니메이션 컨트롤 | 컨트롤 패널에서 애니메이션 제어 | animations.js |
| **`public/js/config.js`** | 클라이언트 설정 | 클라이언트 측 기본 설정 | - |

## 📊 파일별 의존성 관계

### 🔄 핵심 의존성:
```
server.js (메인 진입점)
├── models/index.js (데이터베이스 연결)
│   ├── models/User.js (사용자 모델)
│   ├── models/Template.js (템플릿 모델)
│   ├── models/Match.js (경기 모델)
│   └── models/Sport.js (스포츠 모델)
├── backup-restore.js (백업 관리)
└── database-setup.js (DB 연결 설정)
```

### 🛠️ 관리 스크립트 의존성:
```
관리 스크립트들
├── models/index.js (데이터베이스 접근)
├── database-setup.js (데이터베이스 연결)
└── server.js (API 통신)
```

### 🎨 프론트엔드 의존성:
```
프론트엔드 JS
├── server.js (API 통신)
└── config.js (설정)
```

## 🎯 사용 시나리오별 분류

### **🚀 프로덕션 실행:**
- `server.js` (메인)
- `models/*.js` (데이터베이스)
- `public/js/*.js` (프론트엔드)

### **🛠️ 개발/관리:**
- `setup.js`, `seed.js` (초기 설정)
- `generate-matches.js` (테스트 데이터)
- `start-all-matches.js`, `reset-all-matches.js` (경기 관리)

### **🔄 마이그레이션:**
- `migrate-database.js`
- `migrate-to-postgres.js`
- `migrate-user-sport-permissions.js`

### **👥 사용자 관리:**
- `create-admin.js`
- `create-admin-user.js`
- `check-password.js`

### **💾 백업/복원:**
- `backup-restore.js`

## ⚠️ 중요 사항

### **필수 파일 (삭제 금지):**
- `server.js` - 메인 서버
- `models/index.js` - 데이터베이스 연결
- `backup-restore.js` - 백업 기능
- `public/js/*.js` - 프론트엔드 기능

### **관리 스크립트 (필요시 사용):**
- `setup.js` - 초기 설정
- `seed.js` - 데이터 시드
- `migrate-*.js` - 데이터베이스 마이그레이션
- `create-admin*.js` - 관리자 생성
- `*-matches.js` - 경기 관리

### **개발 도구:**
- `generate-matches.js` - 테스트 데이터 생성
- `check-password.js` - 비밀번호 확인
- `randomize-match-times.js` - 시간 랜덤화

## 📝 참고사항

1. **총 23개의 JavaScript 파일**이 각각의 역할을 가지고 프로젝트를 구성
2. **server.js**가 메인 진입점이며, 모든 기능의 중심
3. **models/** 폴더의 파일들은 데이터베이스 모델 정의
4. **public/js/** 폴더의 파일들은 클라이언트 측 JavaScript
5. 루트의 스크립트들은 주로 관리 및 유틸리티 용도

---
*이 문서는 SportsCoder 프로젝트의 JavaScript 파일 구조를 정리한 참고 문서입니다.*
