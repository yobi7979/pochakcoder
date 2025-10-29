# 🚀 SportsCoder DB 마이그레이션 가이드

## 📋 빠른 시작

### 1. 전체 마이그레이션 (권장)
```bash
node migration-runner.js --full
```

### 2. 마이그레이션 상태 확인
```bash
node migration-runner.js --check
```

### 3. 누락된 테이블만 생성
```bash
node migration-runner.js --missing
```

## 📁 마이그레이션 파일 구조

```
SportsCoder/
├── migration-runner.js              # 🎯 메인 실행기 (사용 권장)
├── migrate-stage-to-main.js         # 전체 마이그레이션 스크립트
├── create-missing-tables-fixed.js   # 누락된 테이블 생성 스크립트
├── check-main-db-tables.js          # 마이그레이션 상태 확인 스크립트
├── 마이그레이션.md                   # 상세 가이드 문서
└── MIGRATION_README.md              # 이 파일
```

## 🎯 사용 시나리오

### 시나리오 1: 새로운 Main 프로젝트 배포
```bash
# 1. 전체 마이그레이션 실행
node migration-runner.js --full

# 2. 결과 확인
node migration-runner.js --check
```

### 시나리오 2: 기존 Main DB에 누락된 테이블 추가
```bash
# 1. 현재 상태 확인
node migration-runner.js --check

# 2. 누락된 테이블 생성
node migration-runner.js --missing
```

### 시나리오 3: 마이그레이션 상태 점검
```bash
node migration-runner.js --check
```

## ⚡ 자동화된 실행기 기능

### `migration-runner.js`의 장점
- ✅ **의존성 자동 확인** - pg 패키지 자동 설치
- ✅ **스크립트 파일 검증** - 필수 파일 존재 확인
- ✅ **단계별 실행** - 순서대로 안전하게 실행
- ✅ **오류 처리** - 각 단계별 오류 감지 및 보고
- ✅ **컬러 출력** - 가독성 좋은 로그 출력
- ✅ **도움말** - `--help` 옵션으로 사용법 확인

## 🔧 수동 실행 (고급 사용자)

### 1. 전체 마이그레이션
```bash
node migrate-stage-to-main.js
node create-missing-tables-fixed.js
node check-main-db-tables.js
```

### 2. 개별 실행
```bash
# 마이그레이션 상태만 확인
node check-main-db-tables.js

# 누락된 테이블만 생성
node create-missing-tables-fixed.js
```

## 📊 마이그레이션 결과

### 성공적인 마이그레이션 후 확인사항
- ✅ **13개 테이블** 모두 존재
- ✅ **기본 설정 데이터** 28개 레코드
- ✅ **스포츠 종목** 5개 레코드
- ✅ **사용자 계정** 2개 레코드
- ✅ **템플릿 데이터** 2개 레코드
- ✅ **세션 데이터** 8개 레코드

## 🚨 문제 해결

### 1. 연결 오류
```
Error: connect ECONNREFUSED
```
**해결**: 연결 문자열 확인 및 네트워크 상태 점검

### 2. 의존성 오류
```
Cannot find module 'pg'
```
**해결**: `npm install pg` 실행

### 3. 스크립트 파일 없음
```
Cannot find module './migrate-stage-to-main.js'
```
**해결**: 모든 스크립트 파일이 같은 디렉토리에 있는지 확인

## 📝 체크리스트

마이그레이션 전:
- [ ] Stage DB 연결 가능한지 확인
- [ ] Main DB 연결 가능한지 확인
- [ ] 필요한 패키지 설치됨 (`npm install pg`)
- [ ] 모든 스크립트 파일 존재

마이그레이션 후:
- [ ] 모든 테이블 생성됨
- [ ] 데이터 정상 삽입됨
- [ ] 애플리케이션 정상 작동
- [ ] 백업 파일 보관

## 🔄 재마이그레이션

필요시 언제든지 재실행 가능:
```bash
node migration-runner.js --full
```

기존 데이터는 `ON CONFLICT DO NOTHING`으로 보호됩니다.

## 📞 지원

문제 발생시:
1. 오류 메시지 확인
2. `--check` 옵션으로 상태 확인
3. 연결 문자열 검증
4. 네트워크 상태 점검

---

**최종 업데이트**: 2025-10-29
**버전**: 2.0
**작성자**: SportsCoder 개발팀
