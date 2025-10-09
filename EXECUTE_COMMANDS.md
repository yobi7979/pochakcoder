# 🚀 Railway PostgreSQL 스키마 수정 실행 명령어

## 📋 실행 방법 (3가지)

### 1. 🖥️ Windows 배치 파일 실행 (가장 간단)
```cmd
fix-schema.bat
```

### 2. 💻 PowerShell 스크립트 실행
```powershell
.\fix-schema.ps1
```

### 3. 🔧 Node.js 스크립트 직접 실행
```cmd
node railway-schema-fix.js
```

## 🚀 자동 실행 명령어

### Railway CLI 설치 및 실행 (한 번에)
```cmd
npm install -g @railway/cli && railway login && railway link && node railway-schema-fix.js
```

### 수동 SQL 실행 (Railway 대시보드)
1. https://railway.app 접속
2. 프로젝트 선택
3. PostgreSQL > Query 탭
4. 다음 SQL 실행:

```sql
ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
```

## 🔍 실행 후 확인

### 테이블 구조 확인 SQL
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'Sports'
ORDER BY ordinal_position;
```

### 예상 결과
- id: integer
- name: character varying
- code: character varying
- template: character varying
- description: text
- is_active: boolean
- is_default: boolean
- created_by: integer
- created_at: timestamp
- updated_at: timestamp

## 🚨 문제 해결

### Railway CLI 설치 실패 시
```cmd
npm install -g @railway/cli --force
```

### Railway 로그인 실패 시
```cmd
railway login --browserless
```

### 프로젝트 연결 실패 시
```cmd
railway link --force
```

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. Node.js 설치 여부
2. Railway CLI 설치 여부
3. Railway 로그인 상태
4. 프로젝트 연결 상태
