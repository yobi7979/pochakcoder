@echo off
cd /d %~dp0
git add -A
git commit -m "자동화: 전체 프로젝트 변경사항 커밋 및 푸시"
git push origin master
pause 