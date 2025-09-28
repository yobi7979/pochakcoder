# SportsCoder - 스포츠 경기 실시간 오버레이 시스템

## 로컬 개발 환경 설정

### 1. 로컬 개발 모드로 서버 실행

로컬에서 DB 수정으로 인한 서버 초기화 실패를 방지하기 위해 다음 방법 중 하나를 사용하세요:

#### 방법 1: 배치 파일 사용 (Windows)
```bash
start-local.bat
```

#### 방법 2: 환경 변수 설정
```bash
# Windows
set LOCAL_DEV=true && npm run dev

# Linux/Mac
LOCAL_DEV=true npm run dev
```

#### 방법 3: package.json 스크립트 사용
```bash
npm run dev:local
```

### 2. 로컬 개발 모드의 특징

- **DB 동기화**: `alter: false`로 설정하여 기존 DB 구조를 최대한 보존
- **오류 처리**: DB 동기화 실패 시에도 서버가 계속 실행됨
- **안전한 모드**: Railway 배포와 달리 로컬에서는 기존 데이터를 보호

### 3. 일반 개발 모드

Railway 배포와 동일한 환경으로 테스트하려면:
```bash
npm run dev
```

### 4. 프로덕션 배포

Railway에서 자동으로 배포되며, 프로덕션 환경에서는 `alter: true`로 설정되어 스키마 업데이트가 허용됩니다.

## 문제 해결

### DB 초기화 실패 시
1. 로컬 개발 모드로 실행: `start-local.bat` 또는 `npm run dev:local`
2. 기존 DB 파일 백업 후 삭제
3. 서버 재시작

### Railway 배포는 정상 작동하는 경우
- 로컬 DB와 Railway DB의 스키마 차이로 인한 문제
- 로컬 개발 모드 사용 권장