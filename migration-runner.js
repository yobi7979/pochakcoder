#!/usr/bin/env node

/**
 * SportsCoder DB 마이그레이션 실행기
 * 
 * 사용법:
 * node migration-runner.js [옵션]
 * 
 * 옵션:
 * --full: 전체 마이그레이션 실행
 * --missing: 누락된 테이블만 생성
 * --check: 마이그레이션 상태 확인
 * --help: 도움말 표시
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  log(`${colors.green}✅${colors.reset} ${message}`);
}

function logError(message) {
  log(`${colors.red}❌${colors.reset} ${message}`);
}

function logWarning(message) {
  log(`${colors.yellow}⚠️${colors.reset} ${message}`);
}

function showHelp() {
  log('\n' + colors.bright + 'SportsCoder DB 마이그레이션 실행기' + colors.reset);
  log('='.repeat(50));
  log('\n사용법:');
  log('  node migration-runner.js [옵션]');
  log('\n옵션:');
  log('  --full     전체 마이그레이션 실행 (Stage → Main)');
  log('  --missing  누락된 테이블만 생성');
  log('  --check    마이그레이션 상태 확인');
  log('  --help     이 도움말 표시');
  log('\n예시:');
  log('  node migration-runner.js --full');
  log('  node migration-runner.js --check');
  log('  node migration-runner.js --missing');
}

function checkDependencies() {
  logStep('1', '의존성 확인 중...');
  
  try {
    // package.json 확인
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json 파일을 찾을 수 없습니다.');
    }
    
    // pg 패키지 확인
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!packageJson.dependencies || !packageJson.dependencies.pg) {
      logWarning('pg 패키지가 설치되지 않았습니다. 설치 중...');
      execSync('npm install pg', { stdio: 'inherit' });
    }
    
    logSuccess('의존성 확인 완료');
    return true;
  } catch (error) {
    logError(`의존성 확인 실패: ${error.message}`);
    return false;
  }
}

function checkScripts() {
  logStep('2', '스크립트 파일 확인 중...');
  
  const requiredScripts = [
    'migrate-stage-to-main.js',
    'create-missing-tables-fixed.js',
    'check-main-db-tables.js'
  ];
  
  const missingScripts = requiredScripts.filter(script => !fs.existsSync(script));
  
  if (missingScripts.length > 0) {
    logError(`필수 스크립트 파일이 없습니다: ${missingScripts.join(', ')}`);
    return false;
  }
  
  logSuccess('모든 스크립트 파일 확인 완료');
  return true;
}

function runScript(scriptName, description) {
  try {
    logStep('실행', `${description} 중...`);
    execSync(`node ${scriptName}`, { stdio: 'inherit' });
    logSuccess(`${description} 완료`);
    return true;
  } catch (error) {
    logError(`${description} 실패: ${error.message}`);
    return false;
  }
}

function runFullMigration() {
  log('\n' + colors.bright + '🚀 전체 마이그레이션 시작' + colors.reset);
  log('='.repeat(50));
  
  if (!checkDependencies() || !checkScripts()) {
    return false;
  }
  
  // 1. 전체 마이그레이션
  if (!runScript('migrate-stage-to-main.js', 'Stage DB → Main DB 마이그레이션')) {
    return false;
  }
  
  // 2. 누락된 테이블 생성
  if (!runScript('create-missing-tables-fixed.js', '누락된 테이블 생성')) {
    return false;
  }
  
  // 3. 결과 확인
  if (!runScript('check-main-db-tables.js', '마이그레이션 결과 확인')) {
    return false;
  }
  
  logSuccess('\n🎉 전체 마이그레이션이 성공적으로 완료되었습니다!');
  return true;
}

function runMissingTables() {
  log('\n' + colors.bright + '🔧 누락된 테이블 생성' + colors.reset);
  log('='.repeat(50));
  
  if (!checkDependencies() || !checkScripts()) {
    return false;
  }
  
  // 1. 누락된 테이블 생성
  if (!runScript('create-missing-tables-fixed.js', '누락된 테이블 생성')) {
    return false;
  }
  
  // 2. 결과 확인
  if (!runScript('check-main-db-tables.js', '마이그레이션 결과 확인')) {
    return false;
  }
  
  logSuccess('\n🎉 누락된 테이블 생성이 완료되었습니다!');
  return true;
}

function runCheck() {
  log('\n' + colors.bright + '🔍 마이그레이션 상태 확인' + colors.reset);
  log('='.repeat(50));
  
  if (!checkDependencies() || !checkScripts()) {
    return false;
  }
  
  // 마이그레이션 상태 확인
  if (!runScript('check-main-db-tables.js', '마이그레이션 상태 확인')) {
    return false;
  }
  
  logSuccess('\n✅ 마이그레이션 상태 확인 완료!');
  return true;
}

// 메인 실행 함수
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    return;
  }
  
  let success = false;
  
  if (args.includes('--full')) {
    success = runFullMigration();
  } else if (args.includes('--missing')) {
    success = runMissingTables();
  } else if (args.includes('--check')) {
    success = runCheck();
  } else {
    logError('알 수 없는 옵션입니다. --help를 사용하여 도움말을 확인하세요.');
    process.exit(1);
  }
  
  if (success) {
    log('\n' + colors.green + '🎉 작업이 성공적으로 완료되었습니다!' + colors.reset);
    process.exit(0);
  } else {
    log('\n' + colors.red + '❌ 작업이 실패했습니다.' + colors.reset);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  runFullMigration,
  runMissingTables,
  runCheck,
  checkDependencies,
  checkScripts
};
