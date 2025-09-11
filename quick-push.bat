@echo off
chcp 65001 >nul
title 빠른 푸시

echo ========================================
echo            빠른 푸시
echo ========================================
echo.

set /p commit_msg="커밋 메시지: "
if "%commit_msg%"=="" set commit_msg="빠른 커밋"

echo.
echo 변경사항을 추가하고 커밋합니다...
git add .
git commit -m "%commit_msg%"

echo.
echo 어느 저장소에 푸시하시겠습니까?
echo 1. 메인 (pochakcoder)
echo 2. 백업 (sportscoder)
echo 3. 둘 다
echo.
set /p choice="선택 (1-3): "

if "%choice%"=="1" (
    echo 메인 저장소에 푸시합니다...
    git push origin master
) else if "%choice%"=="2" (
    echo 백업 저장소에 푸시합니다...
    git push backup master
) else if "%choice%"=="3" (
    echo 두 저장소 모두에 푸시합니다...
    git push origin master
    git push backup master
) else (
    echo 잘못된 선택입니다.
    pause
    exit
)

echo.
echo 푸시가 완료되었습니다!
pause
