# 📁 Scripts 폴더

이 폴더는 SportsCoder 프로젝트의 유틸리티 스크립트들을 포함합니다.

## 📋 현재 스크립트

현재 이 폴더에는 특별한 스크립트가 없습니다.

## 🔧 스크립트 추가 시 주의사항

1. **환경 변수 확인**: 스크립트 실행 전 필요한 환경 변수가 설정되어 있는지 확인하세요.
2. **데이터베이스 연결**: 데이터베이스 관련 스크립트는 `models/index.js`를 통해 연결하세요.
3. **에러 처리**: 모든 스크립트에는 적절한 에러 처리가 포함되어야 합니다.
4. **로깅**: 실행 과정과 결과를 명확히 로그로 출력하세요.

## 📝 스크립트 작성 가이드

```javascript
// 예시: 데이터베이스 스크립트
const { Match, Sport } = require('../models');

async function exampleScript() {
  try {
    console.log('스크립트 시작...');
    
    // 스크립트 로직
    
    console.log('스크립트 완료');
  } catch (error) {
    console.error('스크립트 실행 중 오류:', error);
    process.exit(1);
  }
}

// 직접 실행 시에만 함수 호출
if (require.main === module) {
  exampleScript();
}

module.exports = { exampleScript };
```

## 🚀 스크립트 실행 방법

```bash
# 직접 실행
node scripts/script-name.js

# Windows 배치 파일
scripts/run-script.bat

# Linux/Mac 셸 스크립트
./scripts/run-script.sh
```