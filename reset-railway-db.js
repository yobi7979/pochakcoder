#!/usr/bin/env node

/**
 * Railway PostgreSQL 데이터베이스 완전 초기화 및 재생성
 * 모든 테이블을 삭제하고 올바른 스키마로 재생성합니다.
 */

const { sequelize } = require('./models');

async function resetRailwayDatabase() {
  try {
    console.log('🚨 Railway PostgreSQL 데이터베이스 완전 초기화 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. Railway에서 실행해주세요.');
      return;
    }
    
    console.log('🔧 모든 테이블 삭제 중...');
    
    // 1. 모든 테이블을 역순으로 삭제 (외래키 제약조건 고려)
    const dropTables = [
      'SportActiveOverlayImages',
      'SportOverlayImages', 
      'TeamInfo',
      'MatchLists',
      'Matches',
      'Settings',
      'UserSportPermissions',
      'Users',
      'Templates',
      'Sports'
    ];
    
    for (const tableName of dropTables) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        console.log(`✅ 테이블 삭제: ${tableName}`);
      } catch (error) {
        console.warn(`⚠️ 테이블 삭제 실패: ${tableName} - ${error.message}`);
      }
    }
    
    console.log('🔧 데이터베이스 스키마 재생성 중...');
    
    // 2. 모델 동기화로 모든 테이블 재생성
    try {
      await sequelize.sync({ force: true });
      console.log('✅ 모든 테이블 재생성 완료');
    } catch (error) {
      console.error('❌ 테이블 재생성 실패:', error);
      throw error;
    }
    
    console.log('🔧 기본 데이터 추가 중...');
    
    // 3. 기본 사용자 생성
    try {
      const { User } = require('./models');
      await User.create({
        username: 'admin',
        password: 'admin123',
        email: 'admin@example.com',
        full_name: '관리자',
        role: 'admin',
        is_active: true
      });
      console.log('✅ 기본 관리자 사용자 생성 완료');
    } catch (error) {
      console.warn(`⚠️ 기본 사용자 생성 실패: ${error.message}`);
    }
    
    // 4. 기본 스포츠 데이터 생성
    try {
      const { Sport } = require('./models');
      await Sport.bulkCreate([
        {
          name: '축구',
          code: 'SOCCER',
          template: 'soccer',
          description: '축구 경기',
          is_active: true,
          is_default: true,
          created_by: 1
        },
        {
          name: '야구',
          code: 'BASEBALL', 
          template: 'baseball',
          description: '야구 경기',
          is_active: true,
          is_default: true,
          created_by: 1
        }
      ]);
      console.log('✅ 기본 스포츠 데이터 생성 완료');
    } catch (error) {
      console.warn(`⚠️ 기본 스포츠 데이터 생성 실패: ${error.message}`);
    }
    
    console.log('🔍 재생성된 테이블 구조 확인 중...');
    
    // 5. 모든 테이블 구조 확인
    const tables = ['Sports', 'Templates', 'Users', 'Matches', 'MatchLists', 'SportOverlayImages', 'SportActiveOverlayImages', 'TeamInfo', 'Settings'];
    for (const tableName of tables) {
      try {
        const tableInfo = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          ORDER BY ordinal_position;
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log(`📋 ${tableName} 테이블 구조:`);
        tableInfo.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      } catch (error) {
        console.warn(`⚠️ ${tableName} 테이블 구조 확인 실패: ${error.message}`);
      }
    }
    
    console.log('✅ Railway PostgreSQL 데이터베이스 완전 초기화 및 재생성 완료');
    
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
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
resetRailwayDatabase();
