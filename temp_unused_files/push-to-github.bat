@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: GitHub 푸시 스크립트 (pochakcoder 저장소, master 브랜치)
echo [36m포착코더 GitHub 푸시 스크립트[0m
echo.

:: Git 저장소 초기화 (없는 경우)
if not exist .git (
    echo [36mGit 저장소 초기화...[0m
    git init
    git remote add origin https://github.com/yobi7979/pochakcoder.git
) else (
    echo [36m기존 Git 저장소 확인...[0m
    git remote -v
)

:: 푸시 대상 저장소 최종 확인
echo.
echo [33m=== 푸시 대상 저장소 확인 ===[0m
echo [36m현재 설정된 원격 저장소:[0m
git remote get-url origin
echo.
echo [33m이 저장소로 푸시됩니다. 계속하시겠습니까?[0m
set /p confirm="계속하려면 Y, 취소하려면 N을 입력하세요 (Y/N): "
if /i not "!confirm!"=="Y" (
    echo [31m푸시가 취소되었습니다.[0m
    pause
    exit /b
)
echo [32m푸시를 계속 진행합니다...[0m

:: 불필요한 파일들 제거 (node_modules는 제외)
echo [36m불필요한 파일들을 정리합니다...[0m
echo [33mnode_modules는 의존성 모듈이므로 보존합니다...[0m
if exist "logs" (
    echo [33mlogs 폴더를 제거합니다...[0m
    rmdir /s /q "logs" 2>nul
)
if exist "temp" (
    echo [33mtemp 폴더를 제거합니다...[0m
    rmdir /s /q "temp" 2>nul
)
if exist "backups" (
    echo [33mbackups 폴더를 제거합니다...[0m
    rmdir /s /q "backups" 2>nul
)

:: .gitignore 파일 생성
echo [36m.gitignore 파일을 생성합니다...[0m
(
echo logs/
echo temp/
echo backups/
echo *.log
echo .env
echo .DS_Store
echo __pycache__/
echo *.pyc
echo *.pyo
echo *.pyd
echo .Python
echo env/
echo venv/
echo .venv/
echo .pytest_cache/
echo .coverage
echo htmlcov/
echo .tox/
echo .cache
echo nosetests.xml
echo coverage.xml
echo *.cover
echo .hypothesis/
echo .pytest_cache/
echo .mypy_cache/
echo .dmypy.json
echo dmypy.json
) > .gitignore

:: 변경된 파일 확인
echo.
echo [36m변경된 파일 목록:[0m
git status --porcelain

:: 커밋 메시지 입력받기
echo.
set /p commit_msg="커밋 메시지를 입력하세요 (기본: 자동 커밋): "
if "!commit_msg!"=="" (
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
    set commit_msg=자동 커밋: !datetime:~0,4!-!datetime:~4,2!-!datetime:~6,2! !datetime:~8,2!:!datetime:~10,2!:!datetime:~12,2!
)

:: 변경사항 커밋 및 푸시
echo [36m변경사항을 커밋합니다...[0m
git add .
git commit -m "!commit_msg!"

:: master 브랜치로 강제 푸시
echo [33mmaster 브랜치로 강제 푸시를 실행합니다...[0m
git push -f origin master

if !errorlevel! equ 0 (
    echo.
    echo [32m코드가 성공적으로 깃허브에 푸시되었습니다![0m
    echo [32m저장소 URL: https://github.com/yobi7979/pochakcoder[0m
) else (
    echo.
    echo [31m오류: GitHub 푸시 중 문제가 발생했습니다.[0m
    echo [31m인터넷 연결과 GitHub 인증을 확인해주세요.[0m
)

echo.
echo [90m아무 키나 누르면 종료됩니다...[0m
pause > nul
