@echo off
chcp 65001 >nul
echo 🚀 Railway PostgreSQL 스키마 수정 스크립트
echo ==========================================
echo.

echo 🔍 Node.js 설치 확인 중...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js가 설치되지 않았습니다.
    echo 🔧 Node.js 설치 후 다시 실행하세요: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js 설치됨

echo.
echo 🔍 Railway CLI 설치 확인 중...
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI가 설치되지 않음
    echo 🔧 Railway CLI 설치 중...
    npm install -g @railway/cli
    if %errorlevel% neq 0 (
        echo ❌ Railway CLI 설치 실패
        echo 🔧 수동 실행 방법을 사용하세요
        goto :manual
    )
    echo ✅ Railway CLI 설치 완료
) else (
    echo ✅ Railway CLI 설치됨
)

echo.
echo 🚀 스키마 수정 스크립트 실행 중...
node railway-schema-fix.js

echo.
echo ✅ 스크립트 실행 완료
pause
exit /b 0

:manual
echo.
echo 🔧 수동 실행 방법:
echo 1. Railway 대시보드 접속: https://railway.app
echo 2. 프로젝트 선택
echo 3. PostgreSQL 서비스 클릭
echo 4. Query 탭에서 다음 SQL 실행:
echo.
echo    ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
echo    ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
echo    ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
echo.
pause
exit /b 0
