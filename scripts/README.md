# Railway PostgreSQL 배구 스키마 업데이트

이 폴더에는 Railway PostgreSQL 환경에서 배구 데이터 구조를 수정하는 스크립트들이 포함되어 있습니다.

## 📋 수정 내용

### 데이터베이스 구조 개선
- **`home_score`/`away_score`**: 토탈 세트 승리 수 저장 (원형 도형으로 표시)
- **`match_data.home_score`/`match_data.away_score`**: 현재 세트 점수 저장 (상단 숫자로 표시)
- **`match_data.setFormat`**: 세트제 정보 저장 (3세트 또는 5세트)
- **`match_data.set_scores`**: 각 세트별 점수 저장
- **`match_data.servingTeam`**: 서브권 정보 저장

## 🚀 사용법

### 1. Railway 환경에서 실행

#### Windows 환경
```bash
# Railway CLI로 Railway 환경에 접속
railway login
railway link

# 환경 변수 설정 확인
railway variables

# 스키마 업데이트 실행
scripts/run-volleyball-schema-update.bat
```

#### Linux/Mac 환경
```bash
# Railway CLI로 Railway 환경에 접속
railway login
railway link

# 환경 변수 설정 확인
railway variables

# 스키마 업데이트 실행
./scripts/run-volleyball-schema-update.sh
```

### 2. 직접 Node.js로 실행

```bash
# Railway 환경에서
node scripts/update-volleyball-schema.js
```

## 📊 스크립트 기능

### `update-volleyball-schema.js`
- 기존 배구 경기 데이터 확인
- 데이터 구조 수정 (토탈 세트 승리 수 vs 현재 세트 점수 구분)
- 수정된 데이터 검증
- 인덱스 최적화 (선택사항)

### `run-volleyball-schema-update.bat` (Windows)
- 환경 변수 확인
- Node.js 버전 확인
- 스키마 업데이트 실행
- 결과 보고

### `run-volleyball-schema-update.sh` (Linux/Mac)
- 환경 변수 확인
- Node.js 버전 확인
- 스키마 업데이트 실행
- 결과 보고

## ⚠️ 주의사항

1. **Railway 환경에서만 실행**: 이 스크립트는 Railway PostgreSQL 환경에서만 작동합니다.
2. **백업 권장**: 중요한 데이터가 있는 경우 실행 전 백업을 권장합니다.
3. **환경 변수 확인**: `DATABASE_URL`이 PostgreSQL URL인지 확인하세요.

## 🔍 실행 전 확인사항

```bash
# 1. Railway 환경 확인
railway status

# 2. 데이터베이스 연결 확인
railway variables | grep DATABASE_URL

# 3. 기존 배구 데이터 확인
node -e "
const { Match } = require('./models');
Match.findAll({ where: { sport_type: 'VOLLEYBALL' } })
  .then(matches => console.log('배구 경기 수:', matches.length))
  .catch(err => console.error('오류:', err));
"
```

## 📈 실행 후 확인

스크립트 실행 후 다음을 확인하세요:

1. **토탈 세트 승리 수**: `home_score`/`away_score` 컬럼
2. **현재 세트 점수**: `match_data.home_score`/`match_data.away_score`
3. **세트제 정보**: `match_data.setFormat`
4. **서브권 정보**: `match_data.servingTeam`

## 🆘 문제 해결

### 오류: "DATABASE_URL이 설정되지 않았습니다"
```bash
# Railway 환경 변수 확인
railway variables

# Railway 환경에 연결
railway link
```

### 오류: "PostgreSQL 연결 실패"
```bash
# 데이터베이스 URL 확인
echo $DATABASE_URL

# Railway 데이터베이스 상태 확인
railway status
```

### 오류: "Node.js가 설치되지 않았습니다"
```bash
# Node.js 설치 확인
node --version

# Railway에서 Node.js 버전 확인
railway variables | grep NODE_VERSION
```
