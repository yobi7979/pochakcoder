@echo off
echo 🔧 Sports 테이블 스키마 수정 스크립트 실행
echo.

REM Railway 환경 변수 설정 (실제 DATABASE_URL로 교체 필요)
set DATABASE_URL=postgresql://postgres:password@host:port/database

echo 📋 DATABASE_URL 설정됨
echo.

echo 🚀 스키마 수정 시작...
node fix-sports-schema.js

echo.
echo ✅ 스키마 수정 완료
pause
