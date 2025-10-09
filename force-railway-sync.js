#!/usr/bin/env node

/**
 * Railway PostgreSQL 강제 동기화 스크립트
 * 모델 정의에 맞춰 테이블 구조를 강제로 동기화합니다.
 */

const { sequelize } = require('./models');

async function forceRailwaySync() {
  try {
    console.log('🚀 Railway PostgreSQL 강제 동기화 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. Railway에서 실행해주세요.');
      return;
    }
    
    console.log('🔍 현재 테이블 구조 확인 중...');
    
    // 기존 테이블 구조 확인
    const existingTables = await sequelize.getQueryInterface().showAllTables();
    console.log('📋 존재하는 테이블들:', existingTables);
    
    console.log('🔧 MatchLists 테이블 강제 동기화 중...');
    
    // MatchLists 테이블만 강제 동기화
    try {
      await sequelize.getQueryInterface().dropTable('MatchLists', { cascade: true });
      console.log('✅ 기존 MatchLists 테이블 삭제 완료');
    } catch (error) {
      console.warn('⚠️ 테이블 삭제 실패 (존재하지 않을 수 있음):', error.message);
    }
    
    // 모델 정의에 따라 테이블 재생성
    const { MatchList } = require('./models');
    await MatchList.sync({ force: true });
    console.log('✅ MatchLists 테이블 재생성 완료');
    
    console.log('🔍 동기화된 테이블 구조 확인 중...');
    
    // 동기화된 테이블 구조 확인
    const tableInfo = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'MatchLists' 
      ORDER BY ordinal_position;
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('📋 동기화된 MatchLists 테이블 구조:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('✅ Railway PostgreSQL 강제 동기화 완료');
    
  } catch (error) {
    console.error('❌ 강제 동기화 실패:', error);
    console.error('❌ 오류 상세:', {
      message: error.message,
      stack: error.stack
    });
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// 스크립트 실행
forceRailwaySync();
