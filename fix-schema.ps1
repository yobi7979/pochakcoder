# Railway PostgreSQL 스키마 수정 PowerShell 스크립트
param(
    [switch]$Force
)

Write-Host "🚀 Railway PostgreSQL 스키마 수정 스크립트" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Node.js 설치 확인
Write-Host "🔍 Node.js 설치 확인 중..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 설치됨: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js가 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "🔧 Node.js 설치 후 다시 실행하세요: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "엔터를 눌러 종료"
    exit 1
}

# Railway CLI 설치 확인
Write-Host "🔍 Railway CLI 설치 확인 중..." -ForegroundColor Yellow
try {
    $railwayVersion = railway --version
    Write-Host "✅ Railway CLI 설치됨: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI가 설치되지 않음" -ForegroundColor Red
    Write-Host "🔧 Railway CLI 설치 중..." -ForegroundColor Yellow
    try {
        npm install -g @railway/cli
        Write-Host "✅ Railway CLI 설치 완료" -ForegroundColor Green
    } catch {
        Write-Host "❌ Railway CLI 설치 실패" -ForegroundColor Red
        Write-Host "🔧 수동 실행 방법을 사용하세요" -ForegroundColor Yellow
        goto Manual
    }
}

# 스키마 수정 스크립트 실행
Write-Host "🚀 스키마 수정 스크립트 실행 중..." -ForegroundColor Yellow
try {
    node railway-schema-fix.js
    Write-Host "✅ 스크립트 실행 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 스크립트 실행 실패" -ForegroundColor Red
    Write-Host "🔧 수동 실행 방법을 사용하세요" -ForegroundColor Yellow
    goto Manual
}

Write-Host ""
Write-Host "✅ 스키마 수정 프로세스 완료" -ForegroundColor Green
Write-Host "🔍 오버레이/컨트롤 페이지가 정상 작동하는지 확인하세요." -ForegroundColor Yellow
Read-Host "엔터를 눌러 종료"
exit 0

:Manual
Write-Host ""
Write-Host "🔧 수동 실행 방법:" -ForegroundColor Yellow
Write-Host "1. Railway 대시보드 접속: https://railway.app" -ForegroundColor White
Write-Host "2. 프로젝트 선택" -ForegroundColor White
Write-Host "3. PostgreSQL 서비스 클릭" -ForegroundColor White
Write-Host "4. Query 탭에서 다음 SQL 실행:" -ForegroundColor White
Write-Host ""
Write-Host "   ALTER TABLE `"Sports`" ADD COLUMN IF NOT EXISTS `"created_by`" INTEGER;" -ForegroundColor Cyan
Write-Host "   ALTER TABLE `"Sports`" ADD COLUMN IF NOT EXISTS `"is_active`" BOOLEAN DEFAULT true;" -ForegroundColor Cyan
Write-Host "   ALTER TABLE `"Sports`" ADD COLUMN IF NOT EXISTS `"is_default`" BOOLEAN DEFAULT false;" -ForegroundColor Cyan
Write-Host ""
Read-Host "엔터를 눌러 종료"
exit 0
