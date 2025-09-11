@echo off
chcp 65001 >nul
title Git 원격 저장소 설정

echo ========================================
echo        Git 원격 저장소 설정
echo ========================================
echo.

echo 현재 원격 저장소를 확인합니다...
git remote -v
echo.

echo 백업 저장소를 추가합니다...
git remote add backup https://github.com/yobi7979/sportscoder.git

echo.
echo 설정이 완료되었습니다!
echo.
echo 현재 원격 저장소:
git remote -v
echo.

echo 사용법:
echo - git-push.bat 파일을 실행하여 저장소를 선택하고 푸시하세요
echo - 메인 저장소: pochakcoder
echo - 백업 저장소: sportscoder
echo.

pause
