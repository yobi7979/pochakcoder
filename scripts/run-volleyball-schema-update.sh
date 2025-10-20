#!/bin/bash

# Railway PostgreSQL 배구 스키마 업데이트 실행 스크립트
# 이 스크립트는 Railway 환경에서 배구 데이터 구조를 수정합니다.

echo "🚀 Railway PostgreSQL 배구 스키마 업데이트 시작..."
echo

# Node.js 버전 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되지 않았습니다."
    exit 1
fi

echo "✅ Node.js 버전: $(node --version)"

# 환경 변수 확인
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL 환경 변수가 설정되지 않았습니다."
    echo "Railway 환경에서 실행해주세요."
    exit 1
fi

echo "✅ 환경 변수 확인 완료"
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."
echo

# 스키마 업데이트 실행
echo "🔧 배구 스키마 업데이트 실행 중..."
node scripts/update-volleyball-schema.js

if [ $? -eq 0 ]; then
    echo
    echo "✅ 배구 스키마 업데이트 완료!"
    echo
    echo "📋 수정된 내용:"
    echo "- home_score/away_score: 토탈 세트 승리 수 저장"
    echo "- match_data.home_score/away_score: 현재 세트 점수 저장"
    echo "- match_data.setFormat: 세트제 정보 저장"
    echo "- match_data.set_scores: 각 세트별 점수 저장"
    echo "- match_data.servingTeam: 서브권 정보 저장"
else
    echo
    echo "❌ 배구 스키마 업데이트 실패!"
    echo "오류 코드: $?"
    exit 1
fi

echo
