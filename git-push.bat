@echo off
chcp 65001 >nul
title Git Push Manager

:MAIN_MENU
cls
echo ========================================
echo           Git Push Manager
echo ========================================
echo.
echo 1. 메인 저장소 (pochakcoder)에 푸시
echo 2. 백업 저장소 (sportscoder)에 푸시  
echo 3. 두 저장소 모두에 푸시
echo 4. 현재 상태 확인
echo 5. 종료
echo.
set /p choice="선택하세요 (1-5): "

if "%choice%"=="1" goto PUSH_MAIN
if "%choice%"=="2" goto PUSH_BACKUP
if "%choice%"=="3" goto PUSH_BOTH
if "%choice%"=="4" goto SHOW_STATUS
if "%choice%"=="5" goto EXIT
goto MAIN_MENU

:PUSH_MAIN
cls
echo ========================================
echo      메인 저장소 (pochakcoder) 푸시
echo ========================================
echo.
echo 현재 변경사항을 확인합니다...
git status --short
echo.
set /p commit_msg="커밋 메시지를 입력하세요: "
if "%commit_msg%"=="" set commit_msg="자동 커밋"

echo.
echo 변경사항을 스테이징합니다...
git add .

echo.
echo 커밋을 생성합니다...
git commit -m "%commit_msg%"

echo.
echo 메인 저장소에 푸시합니다...
git push origin master

echo.
echo 푸시가 완료되었습니다!
pause
goto MAIN_MENU

:PUSH_BACKUP
cls
echo ========================================
echo     백업 저장소 (sportscoder) 푸시
echo ========================================
echo.
echo 현재 변경사항을 확인합니다...
git status --short
echo.
set /p commit_msg="커밋 메시지를 입력하세요: "
if "%commit_msg%"=="" set commit_msg="자동 커밋"

echo.
echo 변경사항을 스테이징합니다...
git add .

echo.
echo 커밋을 생성합니다...
git commit -m "%commit_msg%"

echo.
echo 백업 저장소에 푸시합니다...
git push backup master

echo.
echo 푸시가 완료되었습니다!
pause
goto MAIN_MENU

:PUSH_BOTH
cls
echo ========================================
echo        두 저장소 모두에 푸시
echo ========================================
echo.
echo 현재 변경사항을 확인합니다...
git status --short
echo.
set /p commit_msg="커밋 메시지를 입력하세요: "
if "%commit_msg%"=="" set commit_msg="자동 커밋"

echo.
echo 변경사항을 스테이징합니다...
git add .

echo.
echo 커밋을 생성합니다...
git commit -m "%commit_msg%"

echo.
echo 메인 저장소에 푸시합니다...
git push origin master

echo.
echo 백업 저장소에 푸시합니다...
git push backup master

echo.
echo 모든 푸시가 완료되었습니다!
pause
goto MAIN_MENU

:SHOW_STATUS
cls
echo ========================================
echo           현재 Git 상태
echo ========================================
echo.
echo 원격 저장소:
git remote -v
echo.
echo 현재 브랜치:
git branch
echo.
echo 변경사항:
git status --short
echo.
echo 최근 커밋:
git log --oneline -5
echo.
pause
goto MAIN_MENU

:EXIT
echo.
echo Git Push Manager를 종료합니다.
exit
