#!/usr/bin/env node

const { Sequelize } = require('sequelize');

console.log('🚀 Railway PostgreSQL 자동 스키마 수정 시작...');
console.log('==============================================');

// Railway PostgreSQL 연결
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Railway 환경에서 로깅 비활성화
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function fixSportsSchema() {
  try {
    console.log('🔧 Sports 테이블 스키마 자동 수정 중...');
    
    // 1. Sports 테이블 존재 확인
    const tableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Sports'
      );
    `);
    
    if (!tableExists[0][0].exists) {
      console.log('⚠️ Sports 테이블이 존재하지 않음. 서버 시작을 기다립니다...');
      return;
    }
    
    console.log('✅ Sports 테이블 존재 확인');
    
    // 2. created_by 컬럼 확인 및 추가
    const createdByExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Sports' 
        AND column_name = 'created_by'
      );
    `);
    
    if (!createdByExists[0][0].exists) {
      console.log('🔧 created_by 컬럼 추가 중...');
      await sequelize.query(`
        ALTER TABLE "Sports" 
        ADD COLUMN "created_by" INTEGER;
      `);
      console.log('✅ created_by 컬럼 추가 완료');
    } else {
      console.log('✅ created_by 컬럼이 이미 존재함');
    }
    
    // 3. is_active 컬럼 확인 및 추가
    const isActiveExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Sports' 
        AND column_name = 'is_active'
      );
    `);
    
    if (!isActiveExists[0][0].exists) {
      console.log('🔧 is_active 컬럼 추가 중...');
      await sequelize.query(`
        ALTER TABLE "Sports" 
        ADD COLUMN "is_active" BOOLEAN DEFAULT true;
      `);
      console.log('✅ is_active 컬럼 추가 완료');
    } else {
      console.log('✅ is_active 컬럼이 이미 존재함');
    }
    
    // 4. is_default 컬럼 확인 및 추가
    const isDefaultExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Sports' 
        AND column_name = 'is_default'
      );
    `);
    
    if (!isDefaultExists[0][0].exists) {
      console.log('🔧 is_default 컬럼 추가 중...');
      await sequelize.query(`
        ALTER TABLE "Sports" 
        ADD COLUMN "is_default" BOOLEAN DEFAULT false;
      `);
      console.log('✅ is_default 컬럼 추가 완료');
    } else {
      console.log('✅ is_default 컬럼이 이미 존재함');
    }
    
    // 5. 최종 테이블 구조 확인
    const tableStructure = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Sports'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 최종 Sports 테이블 구조:');
    tableStructure[0].forEach(column => {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });
    
    console.log('✅ Sports 테이블 스키마 수정 완료');
    
  } catch (error) {
    console.error('❌ 스키마 수정 실패:', error.message);
    console.error('❌ 오류 상세:', error.stack);
  } finally {
    await sequelize.close();
  }
}

// 스크립트 실행
fixSportsSchema();
