@echo off
echo ========================================
echo 서버 완전 재시작 스크립트
echo ========================================

echo.
echo 1단계: 실행 중인 Node.js 프로세스 종료 중...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo Node.js 프로세스 종료 완료
) else (
    echo 실행 중인 Node.js 프로세스가 없습니다
)

echo.
echo 2단계: 포트 3000 사용 프로세스 확인 및 종료...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo 포트 3000 사용 프로세스 PID: %%a
    taskkill /f /pid %%a 2>nul
    if %errorlevel% equ 0 (
        echo PID %%a 프로세스 종료 완료
    ) else (
        echo PID %%a 프로세스 종료 실패 또는 이미 종료됨
    )
)

echo.
echo 3단계: 3초 대기...
timeout /t 3 /nobreak >nul

echo.
echo 4단계: 포트 상태 확인...
netstat -ano | findstr :3000
if %errorlevel% equ 0 (
    echo 경고: 포트 3000이 여전히 사용 중입니다
) else (
    echo 포트 3000이 사용 가능합니다
)

echo.
echo 5단계: 서버 시작...
echo 로컬 개발 모드로 서버를 시작합니다...
set LOCAL_DEV=true
set NODE_ENV=development
npm run dev

echo.
echo 서버 시작 완료!
pause
