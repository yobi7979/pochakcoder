# 🚀 Railway 시작 시 자동 스키마 수정 명령어

## 📋 Railway에서 설정할 명령어

### 1. Railway 대시보드에서 설정
1. **Railway 대시보드** → **프로젝트** → **Settings**
2. **Deploy** 탭 선택
3. **Start Command** 필드에 다음 명령어 입력:

```bash
npm run start
```

### 2. Railway CLI로 설정
```bash
railway variables set START_COMMAND="npm run start"
```

### 3. Railway 설정 파일 사용
프로젝트 루트에 `railway.json` 파일이 있으면 자동으로 설정됩니다.

## 🔧 자동 실행 과정

### 1단계: 스키마 수정 스크립트 실행
```bash
node railway-startup-schema-fix.js
```
- Sports 테이블 존재 확인
- created_by 컬럼 추가
- is_active 컬럼 추가  
- is_default 컬럼 추가

### 2단계: 서버 시작
```bash
node server.js
```
- Express 서버 시작
- WebSocket 연결
- 라우터 연결

## 📋 실행 로그 예시

```
🚀 Railway PostgreSQL 자동 스키마 수정 시작...
==============================================
🔧 Sports 테이블 스키마 자동 수정 중...
✅ Sports 테이블 존재 확인
🔧 created_by 컬럼 추가 중...
✅ created_by 컬럼 추가 완료
🔧 is_active 컬럼 추가 중...
✅ is_active 컬럼 추가 완료
🔧 is_default 컬럼 추가 중...
✅ is_default 컬럼 추가 완료
📋 최종 Sports 테이블 구조:
  - id: integer (nullable: false)
  - name: character varying (nullable: false)
  - code: character varying (nullable: false)
  - template: character varying (nullable: false)
  - description: text (nullable: true)
  - is_active: boolean (nullable: true)
  - is_default: boolean (nullable: true)
  - created_by: integer (nullable: true)
  - created_at: timestamp with time zone (nullable: true)
  - updated_at: timestamp with time zone (nullable: true)
✅ Sports 테이블 스키마 수정 완료
🚀 서버가 포트 3000에서 실행 중입니다.
```

## 🎯 Railway 설정 방법

### 방법 1: Railway 대시보드
1. https://railway.app 접속
2. 프로젝트 선택
3. Settings → Deploy
4. Start Command: `npm run start`

### 방법 2: Railway CLI
```bash
railway variables set START_COMMAND="npm run start"
```

### 방법 3: railway.json 파일
프로젝트 루트에 `railway.json` 파일이 있으면 자동으로 설정됩니다.

## 🔍 확인 방법

### 1. Railway 로그 확인
Railway 대시보드 → 프로젝트 → Deployments → 로그 확인

### 2. 오버레이 페이지 테스트
- `/soccer/10092706/overlay` 접속
- 정상적으로 로드되는지 확인

### 3. 컨트롤 페이지 테스트
- `/soccer/10092706/control` 접속
- 정상적으로 로드되는지 확인

## 🚨 문제 해결

### 스키마 수정 실패 시
```bash
npm run fix-schema
```

### 원래 서버만 시작하려면
```bash
npm run start:original
```

### 수동 스키마 수정
Railway 대시보드 → PostgreSQL → Query에서 SQL 실행:
```sql
ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
```
