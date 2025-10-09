@echo off
echo 🚀 Railway PostgreSQL 데이터베이스 초기화 시작...

REM 데이터베이스 초기화 실행
node railway-db-init.js

REM 초기화 성공 시 서버 시작
if %errorlevel% equ 0 (
    echo ✅ 데이터베이스 초기화 완료 - 서버 시작
    node server.js
) else (
    echo ❌ 데이터베이스 초기화 실패
    exit /b 1
)
