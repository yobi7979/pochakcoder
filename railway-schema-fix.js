#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Railway PostgreSQL 스키마 수정 시작...');
console.log('');

// Railway CLI 설치 확인
function checkRailwayCLI() {
  try {
    execSync('railway --version', { stdio: 'pipe' });
    console.log('✅ Railway CLI 설치됨');
    return true;
  } catch (error) {
    console.log('❌ Railway CLI가 설치되지 않음');
    console.log('🔧 Railway CLI 설치 중...');
    try {
      execSync('npm install -g @railway/cli', { stdio: 'inherit' });
      console.log('✅ Railway CLI 설치 완료');
      return true;
    } catch (installError) {
      console.log('❌ Railway CLI 설치 실패:', installError.message);
      return false;
    }
  }
}

// Railway 로그인 확인
function checkRailwayLogin() {
  try {
    execSync('railway whoami', { stdio: 'pipe' });
    console.log('✅ Railway 로그인됨');
    return true;
  } catch (error) {
    console.log('❌ Railway 로그인 필요');
    console.log('🔧 Railway 로그인 시도...');
    try {
      execSync('railway login', { stdio: 'inherit' });
      console.log('✅ Railway 로그인 완료');
      return true;
    } catch (loginError) {
      console.log('❌ Railway 로그인 실패:', loginError.message);
      return false;
    }
  }
}

// 프로젝트 연결 확인
function checkProjectLink() {
  try {
    execSync('railway status', { stdio: 'pipe' });
    console.log('✅ 프로젝트 연결됨');
    return true;
  } catch (error) {
    console.log('❌ 프로젝트 연결 필요');
    console.log('🔧 프로젝트 연결 시도...');
    try {
      execSync('railway link', { stdio: 'inherit' });
      console.log('✅ 프로젝트 연결 완료');
      return true;
    } catch (linkError) {
      console.log('❌ 프로젝트 연결 실패:', linkError.message);
      return false;
    }
  }
}

// PostgreSQL 스키마 수정
function fixPostgreSQLSchema() {
  console.log('🔧 PostgreSQL 스키마 수정 중...');
  
  const sqlCommands = [
    'ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;',
    'ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;',
    'ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;'
  ];
  
  try {
    // Railway CLI를 통해 PostgreSQL에 연결하여 SQL 실행
    const sqlScript = sqlCommands.join('\n');
    
    // 임시 SQL 파일 생성
    const tempSqlFile = path.join(__dirname, 'temp_schema_fix.sql');
    fs.writeFileSync(tempSqlFile, sqlScript);
    
    console.log('📋 실행할 SQL 명령어:');
    sqlCommands.forEach((cmd, index) => {
      console.log(`  ${index + 1}. ${cmd}`);
    });
    
    // Railway CLI를 통해 PostgreSQL 실행
    console.log('🚀 Railway PostgreSQL에 연결하여 스키마 수정 실행...');
    
    // Railway CLI를 통해 PostgreSQL에 연결
    const railwayCommand = `railway run psql -c "${sqlCommands.join('; ')}"`;
    console.log('🔧 실행 명령어:', railwayCommand);
    
    try {
      execSync(railwayCommand, { stdio: 'inherit' });
      console.log('✅ 스키마 수정 완료');
    } catch (railwayError) {
      console.log('⚠️ Railway CLI 실행 실패, 대안 방법 시도...');
      
      // 대안: 직접 PostgreSQL 연결
      console.log('🔧 직접 PostgreSQL 연결 시도...');
      console.log('📋 다음 SQL 명령어를 Railway 대시보드에서 실행하세요:');
      console.log('');
      sqlCommands.forEach((cmd, index) => {
        console.log(`${index + 1}. ${cmd}`);
      });
      console.log('');
      console.log('🌐 Railway 대시보드: https://railway.app');
      console.log('📋 프로젝트 > PostgreSQL > Query 탭에서 위 SQL 실행');
    }
    
    // 임시 파일 삭제
    if (fs.existsSync(tempSqlFile)) {
      fs.unlinkSync(tempSqlFile);
    }
    
  } catch (error) {
    console.log('❌ 스키마 수정 실패:', error.message);
    console.log('');
    console.log('🔧 수동 실행 방법:');
    console.log('1. Railway 대시보드 접속: https://railway.app');
    console.log('2. 프로젝트 > PostgreSQL > Query 탭');
    console.log('3. 다음 SQL 실행:');
    sqlCommands.forEach((cmd, index) => {
      console.log(`   ${index + 1}. ${cmd}`);
    });
  }
}

// 메인 실행 함수
async function main() {
  console.log('🔍 Railway CLI 확인 중...');
  
  if (!checkRailwayCLI()) {
    console.log('❌ Railway CLI 설치 실패. 수동 실행을 권장합니다.');
    console.log('');
    console.log('🔧 수동 실행 방법:');
    console.log('1. Railway 대시보드 접속: https://railway.app');
    console.log('2. 프로젝트 > PostgreSQL > Query 탭');
    console.log('3. 다음 SQL 실행:');
    console.log('   ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;');
    console.log('   ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;');
    console.log('   ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;');
    return;
  }
  
  console.log('🔍 Railway 로그인 확인 중...');
  if (!checkRailwayLogin()) {
    console.log('❌ Railway 로그인 실패. 수동 실행을 권장합니다.');
    return;
  }
  
  console.log('🔍 프로젝트 연결 확인 중...');
  if (!checkProjectLink()) {
    console.log('❌ 프로젝트 연결 실패. 수동 실행을 권장합니다.');
    return;
  }
  
  console.log('🚀 스키마 수정 시작...');
  fixPostgreSQLSchema();
  
  console.log('');
  console.log('✅ 스키마 수정 프로세스 완료');
  console.log('🔍 오버레이/컨트롤 페이지가 정상 작동하는지 확인하세요.');
}

// 스크립트 실행
main().catch(console.error);
