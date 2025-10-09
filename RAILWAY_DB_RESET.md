# Railway PostgreSQL 데이터베이스 초기화 가이드

## 🚀 Railway에서 데이터베이스 초기화 실행

### 1. Railway CLI 설치 및 로그인
```bash
npm install -g @railway/cli
railway login
```

### 2. 프로젝트 연결
```bash
railway link
```

### 3. 데이터베이스 초기화 실행
```bash
railway run node railway-reset-db.js
```

## 📋 스크립트 기능

### `railway-reset-db.js`
- **목적**: Railway PostgreSQL 데이터베이스를 리팩토링 이후 스키마로 완전히 재생성
- **기능**:
  - 기존 테이블 및 데이터 완전 삭제
  - 리팩토링 이후 스키마로 테이블 재생성
  - 기본 데이터 삽입 (관리자, 스포츠, 템플릿)

### 생성되는 기본 데이터
- **사용자**: admin/admin123
- **스포츠**: 축구(SOCCER), 야구(BASEBALL)
- **템플릿**: soccer, baseball

## ⚠️ 주의사항

1. **데이터 손실**: 이 스크립트는 모든 기존 데이터를 삭제합니다
2. **Railway 전용**: PostgreSQL 환경에서만 실행됩니다
3. **백업 권장**: 중요한 데이터가 있다면 미리 백업하세요

## 🔧 문제 해결

### PostgreSQL 연결 오류
```bash
# 환경 변수 확인
railway variables
```

### 스크립트 실행 오류
```bash
# 로그 확인
railway logs
```

## 📞 지원

문제가 발생하면 Railway 로그를 확인하고 오류 메시지를 공유해주세요.
