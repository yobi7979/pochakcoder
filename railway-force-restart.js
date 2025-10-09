#!/usr/bin/env node

const { Sequelize } = require('sequelize');

console.log('🚨 Railway 강제 스키마 수정 시작...');
console.log('==============================================');

async function forceSchemaFix() {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('postgres')) {
    console.log('⚠️ PostgreSQL 환경이 아니므로 스크립트를 건너뜁니다.');
    return;
  }

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });

  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL 연결 성공');

    // 1. Sports 테이블 완전 삭제
    console.log('🗑️ Sports 테이블 삭제 중...');
    await sequelize.query('DROP TABLE IF EXISTS "Sports" CASCADE;');
    console.log('✅ Sports 테이블 삭제 완료');

    // 2. Sports 테이블 재생성
    console.log('🔧 Sports 테이블 재생성 중...');
    await sequelize.query(`
      CREATE TABLE "Sports" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(255) NOT NULL UNIQUE,
        "template" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "is_active" BOOLEAN DEFAULT true,
        "is_default" BOOLEAN DEFAULT false,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Sports 테이블 재생성 완료');

    // 3. 기본 데이터 삽입
    console.log('🔧 기본 스포츠 데이터 삽입 중...');
    await sequelize.query(`
      INSERT INTO "Sports" ("name", "code", "template", "description", "is_active", "is_default", "created_by") 
      VALUES 
        ('축구', 'SOCCER', 'soccer', '축구 경기', true, true, NULL),
        ('야구', 'BASEBALL', 'baseball', '야구 경기', true, true, NULL);
    `);
    console.log('✅ 기본 스포츠 데이터 삽입 완료');

    // 4. 최종 확인
    const result = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Sports'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 최종 Sports 테이블 구조:');
    result[0].forEach(column => {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });

    const sportsData = await sequelize.query(`SELECT * FROM "Sports";`);
    console.log('📋 기본 스포츠 데이터:');
    sportsData[0].forEach(sport => {
      console.log(`  - ${sport.name} (${sport.code}): ${sport.template}`);
    });

    console.log('✅ 강제 스키마 수정 완료');
    
  } catch (error) {
    console.error('❌ 강제 스키마 수정 실패:', error);
    console.error('❌ 오류 상세:', error.stack);
  } finally {
    await sequelize.close();
  }
}

forceSchemaFix();
