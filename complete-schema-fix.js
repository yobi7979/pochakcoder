#!/usr/bin/env node

/**
 * Railway PostgreSQL 완전 스키마 수정 스크립트
 * 모든 테이블의 누락된 컬럼들을 강제로 추가합니다.
 */

const { sequelize } = require('./models');

async function completeSchemaFix() {
  try {
    console.log('🚨 Railway PostgreSQL 완전 스키마 수정 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. Railway에서 실행해주세요.');
      return;
    }
    
    console.log('🔍 모든 테이블 구조 확인 중...');
    
    // 1. Sports 테이블 완전 수정
    console.log('🔧 Sports 테이블 완전 수정 중...');
    const sportsQueries = [
      `ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;`,
      `ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;`,
      `ALTER TABLE "Sports" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;`
    ];
    
    for (const query of sportsQueries) {
      try {
        await sequelize.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ Sports 컬럼 확인/추가: ${columnName}`);
      } catch (error) {
        console.warn(`⚠️ Sports 컬럼 처리 실패: ${error.message}`);
      }
    }
    
    // 2. Templates 테이블 완전 수정
    console.log('🔧 Templates 테이블 완전 수정 중...');
    const templatesQueries = [
      `ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;`,
      `ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;`
    ];
    
    for (const query of templatesQueries) {
      try {
        await sequelize.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ Templates 컬럼 확인/추가: ${columnName}`);
      } catch (error) {
        console.warn(`⚠️ Templates 컬럼 처리 실패: ${error.message}`);
      }
    }
    
    // 3. MatchLists 테이블 완전 수정
    console.log('🔧 MatchLists 테이블 완전 수정 중...');
    const matchListsQueries = [
      `ALTER TABLE "MatchLists" ADD COLUMN IF NOT EXISTS "pushed_match_id" VARCHAR(255);`,
      `ALTER TABLE "MatchLists" ADD COLUMN IF NOT EXISTS "pushed_match_index" INTEGER DEFAULT 0;`,
      `ALTER TABLE "MatchLists" ADD COLUMN IF NOT EXISTS "pushed_timestamp" BIGINT;`,
      `ALTER TABLE "MatchLists" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;`
    ];
    
    for (const query of matchListsQueries) {
      try {
        await sequelize.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ MatchLists 컬럼 확인/추가: ${columnName}`);
      } catch (error) {
        console.warn(`⚠️ MatchLists 컬럼 처리 실패: ${error.message}`);
      }
    }
    
    // 4. SportOverlayImage 테이블 완전 수정
    console.log('🔧 SportOverlayImage 테이블 완전 수정 중...');
    const sportOverlayImageQueries = [
      `ALTER TABLE "SportOverlayImages" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;`,
      `ALTER TABLE "SportOverlayImages" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;`
    ];
    
    for (const query of sportOverlayImageQueries) {
      try {
        await sequelize.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ SportOverlayImages 컬럼 확인/추가: ${columnName}`);
      } catch (error) {
        console.warn(`⚠️ SportOverlayImages 컬럼 처리 실패: ${error.message}`);
      }
    }
    
    // 5. SportActiveOverlayImage 테이블 완전 수정
    console.log('🔧 SportActiveOverlayImage 테이블 완전 수정 중...');
    const sportActiveOverlayImageQueries = [
      `ALTER TABLE "SportActiveOverlayImages" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;`
    ];
    
    for (const query of sportActiveOverlayImageQueries) {
      try {
        await sequelize.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ SportActiveOverlayImages 컬럼 확인/추가: ${columnName}`);
      } catch (error) {
        console.warn(`⚠️ SportActiveOverlayImages 컬럼 처리 실패: ${error.message}`);
      }
    }
    
    // 6. Users 테이블 완전 수정
    console.log('🔧 Users 테이블 완전 수정 중...');
    const usersQueries = [
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;`
    ];
    
    for (const query of usersQueries) {
      try {
        await sequelize.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ Users 컬럼 확인/추가: ${columnName}`);
      } catch (error) {
        console.warn(`⚠️ Users 컬럼 처리 실패: ${error.message}`);
      }
    }
    
    // 7. 기본 데이터 확인 및 추가
    console.log('🔧 기본 데이터 확인 중...');
    try {
      const sportsCount = await sequelize.query(`SELECT COUNT(*) as count FROM "Sports"`, { type: sequelize.QueryTypes.SELECT });
      console.log(`📊 현재 Sports 테이블 레코드 수: ${sportsCount[0].count}`);
      
      if (sportsCount[0].count === 0) {
        console.log('🔧 기본 스포츠 데이터 추가 중...');
        await sequelize.query(`
          INSERT INTO "Sports" ("name", "code", "template", "description", "is_active", "is_default", "created_by", "created_at", "updated_at") 
          VALUES 
          ('축구', 'SOCCER', 'soccer', '축구 경기', true, true, 1, NOW(), NOW()),
          ('야구', 'BASEBALL', 'baseball', '야구 경기', true, true, 1, NOW(), NOW())
        `);
        console.log('✅ 기본 스포츠 데이터 추가 완료');
      }
    } catch (error) {
      console.warn(`⚠️ 기본 데이터 확인 실패: ${error.message}`);
    }
    
    // 8. 외래키 제약조건 수정
    console.log('🔧 외래키 제약조건 수정 중...');
    try {
      await sequelize.query(`
        ALTER TABLE "TeamInfo" 
        DROP CONSTRAINT IF EXISTS "TeamInfo_match_id_fkey";
      `);
      
      await sequelize.query(`
        ALTER TABLE "TeamInfo" 
        ADD CONSTRAINT "TeamInfo_match_id_fkey" 
        FOREIGN KEY ("match_id") 
        REFERENCES "Matches"("id") 
        ON DELETE CASCADE;
      `);
      
      console.log(`✅ 외래키 제약조건 수정: TeamInfo_match_id_fkey (CASCADE 추가)`);
    } catch (error) {
      console.warn(`⚠️ 외래키 제약조건 수정 실패: ${error.message}`);
    }
    
    console.log('🔍 수정된 모든 테이블 구조 확인 중...');
    
    // 모든 테이블 구조 확인
    const tables = ['Sports', 'Templates', 'MatchLists', 'SportOverlayImages', 'SportActiveOverlayImages', 'Users', 'TeamInfo', 'Matches'];
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
    
    console.log('✅ Railway PostgreSQL 완전 스키마 수정 완료');
    
  } catch (error) {
    console.error('❌ 완전 스키마 수정 실패:', error);
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
completeSchemaFix();
