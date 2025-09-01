@echo off
chcp 65001 > nul
echo 서버 재시작을 시작합니다...

echo 1. 실행 중인 Node.js 프로세스를 종료합니다...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /F /PID %%a
    echo PID %%a 프로세스가 종료되었습니다.
)

echo 2. 잠시 대기합니다...
timeout /t 2 /nobreak > nul

echo 3. 서버를 시작합니다...
start /b node server.js

echo.
echo 서버가 시작되었습니다.
echo.
echo 접속 정보:
echo 로컬 접속: http://localhost:3000
for /f "tokens=*" %%a in ('echo %COMPUTERNAME%') do echo 로컬 네트워크 접속: http://%%a:3000

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    echo 로컬 IP 접속: http://%%a:3000
    goto :continue
)
:continue

echo 외부 IP 확인 중...
for /f %%a in ('curl -s http://api.ipify.org') do (
    echo 외부 IP 접속: http://%%a:3000
)

echo.
echo 서버 로그를 확인하려면 이 창을 닫지 마세요.
pause

echo 서버를 종료합니다...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /F /PID %%a
    echo PID %%a 프로세스가 종료되었습니다.
) 