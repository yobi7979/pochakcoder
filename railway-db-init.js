const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeRailwayDatabase() {
  console.log('🚀 Railway PostgreSQL 데이터베이스 초기화 시작...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. 데이터베이스 연결
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 2. 기존 스키마 완전 삭제 (의존성 순서 고려)
    console.log('🗑️ 기존 스키마 삭제 중...');
    try {
      // 먼저 모든 테이블 삭제
      console.log('📋 테이블 삭제 중...');
      const tablesResult = await client.query(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);
      
      for (const table of tablesResult.rows) {
        try {
          await client.query(`DROP TABLE IF EXISTS public."${table.tablename}" CASCADE`);
          console.log(`  ✅ 테이블 삭제: ${table.tablename}`);
        } catch (error) {
          console.log(`  ⚠️ 테이블 삭제 실패: ${table.tablename} - ${error.message}`);
        }
      }
      
      // 모든 시퀀스 삭제
      console.log('🔢 시퀀스 삭제 중...');
      const sequencesResult = await client.query(`
        SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
      `);
      
      for (const sequence of sequencesResult.rows) {
        try {
          await client.query(`DROP SEQUENCE IF EXISTS public."${sequence.sequencename}" CASCADE`);
          console.log(`  ✅ 시퀀스 삭제: ${sequence.sequencename}`);
        } catch (error) {
          console.log(`  ⚠️ 시퀀스 삭제 실패: ${sequence.sequencename} - ${error.message}`);
        }
      }
      
      // 모든 뷰 삭제
      console.log('👁️ 뷰 삭제 중...');
      const viewsResult = await client.query(`
        SELECT viewname FROM pg_views WHERE schemaname = 'public'
      `);
      
      for (const view of viewsResult.rows) {
        try {
          await client.query(`DROP VIEW IF EXISTS public."${view.viewname}" CASCADE`);
          console.log(`  ✅ 뷰 삭제: ${view.viewname}`);
        } catch (error) {
          console.log(`  ⚠️ 뷰 삭제 실패: ${view.viewname} - ${error.message}`);
        }
      }
      
      // 모든 함수 삭제
      console.log('🔧 함수 삭제 중...');
      const functionsResult = await client.query(`
        SELECT proname, oidvectortypes(proargtypes) as argtypes 
        FROM pg_proc 
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `);
      
      for (const func of functionsResult.rows) {
        try {
          await client.query(`DROP FUNCTION IF EXISTS public."${func.proname}"(${func.argtypes}) CASCADE`);
          console.log(`  ✅ 함수 삭제: ${func.proname}`);
        } catch (error) {
          console.log(`  ⚠️ 함수 삭제 실패: ${func.proname} - ${error.message}`);
        }
      }
      
      // 모든 도메인 삭제
      console.log('🏷️ 도메인 삭제 중...');
      const domainsResult = await client.query(`
        SELECT typname FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
        AND typtype = 'd'
      `);
      
      for (const domain of domainsResult.rows) {
        try {
          await client.query(`DROP DOMAIN IF EXISTS public."${domain.typname}" CASCADE`);
          console.log(`  ✅ 도메인 삭제: ${domain.typname}`);
        } catch (error) {
          console.log(`  ⚠️ 도메인 삭제 실패: ${domain.typname} - ${error.message}`);
        }
      }
      
      // 모든 enum 타입 삭제 (마지막에)
      console.log('📝 enum 타입 삭제 중...');
      const enumsResult = await client.query(`
        SELECT typname FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
        AND typtype = 'e'
      `);
      
      for (const enumType of enumsResult.rows) {
        try {
          await client.query(`DROP TYPE IF EXISTS public."${enumType.typname}" CASCADE`);
          console.log(`  ✅ enum 타입 삭제: ${enumType.typname}`);
        } catch (error) {
          console.log(`  ⚠️ enum 타입 삭제 실패: ${enumType.typname} - ${error.message}`);
        }
      }
      
      // 마지막으로 스키마 삭제
      console.log('🗑️ 스키마 삭제 중...');
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
      console.log('✅ 기존 스키마 삭제 완료');
    } catch (error) {
      console.log('ℹ️ 기존 스키마가 없거나 이미 삭제됨');
    }

    // 3. 새로운 스키마 생성
    console.log('🔄 새로운 스키마 생성 중...');
    await client.query('CREATE SCHEMA public');
    console.log('✅ 새로운 스키마 생성 완료');

    // 4. 권한 설정
    console.log('🔐 권한 설정 중...');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ 권한 설정 완료');

    // 5. 직접 SQL로 테이블 생성 (Sequelize sync 대신)
    console.log('📊 테이블 직접 생성 중...');
    
    // Users 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "username" VARCHAR(255) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255),
        "full_name" VARCHAR(255),
        "role" VARCHAR(50) DEFAULT 'user',
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Users 테이블 생성 완료');

    // Sports 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sports" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(50) UNIQUE NOT NULL,
        "template" VARCHAR(255),
        "description" TEXT,
        "is_active" BOOLEAN DEFAULT true,
        "is_default" BOOLEAN DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Sports 테이블 생성 완료');

    // Templates 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "templates" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "sport_type" VARCHAR(50),
        "template_type" VARCHAR(50),
        "content" TEXT,
        "file_name" VARCHAR(255),
        "is_default" BOOLEAN DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Templates 테이블 생성 완료');

    // Settings 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" SERIAL PRIMARY KEY,
        "key" VARCHAR(255) UNIQUE NOT NULL,
        "value" TEXT,
        "description" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Settings 테이블 생성 완료');

    // Matches 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "matches" (
        "id" SERIAL PRIMARY KEY,
        "sport_type" VARCHAR(50) NOT NULL,
        "home_team" VARCHAR(255) NOT NULL,
        "away_team" VARCHAR(255) NOT NULL,
        "home_score" INTEGER DEFAULT 0,
        "away_score" INTEGER DEFAULT 0,
        "home_color" VARCHAR(7),
        "away_color" VARCHAR(7),
        "status" VARCHAR(50) DEFAULT 'scheduled',
        "match_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Matches 테이블 생성 완료');

    // TeamInfo 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "team_infos" (
        "id" SERIAL PRIMARY KEY,
        "match_id" INTEGER,
        "team_name" VARCHAR(255) NOT NULL,
        "team_color" VARCHAR(7),
        "team_logo" VARCHAR(255),
        "is_home" BOOLEAN DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ TeamInfo 테이블 생성 완료');

    // MatchLists 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "match_lists" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ MatchLists 테이블 생성 완료');

    // SportOverlayImages 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sport_overlay_images" (
        "id" SERIAL PRIMARY KEY,
        "sport_code" VARCHAR(50) NOT NULL,
        "filename" VARCHAR(255) NOT NULL,
        "file_path" VARCHAR(500),
        "file_size" INTEGER,
        "mime_type" VARCHAR(100),
        "is_active" BOOLEAN DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ SportOverlayImages 테이블 생성 완료');

    // SportActiveOverlayImages 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sport_active_overlay_images" (
        "id" SERIAL PRIMARY KEY,
        "sport_code" VARCHAR(50) NOT NULL,
        "overlay_image_id" INTEGER,
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ SportActiveOverlayImages 테이블 생성 완료');

    console.log('✅ 모든 테이블 생성 완료');

    // 6. 기본 데이터 생성 (직접 SQL 사용)
    console.log('🌱 기본 데이터 생성 중...');
    
    // 관리자 계정 생성 (직접 SQL)
    console.log('👤 관리자 계정 생성 중...');
    const existingAdminResult = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (existingAdminResult.rows.length === 0) {
      await client.query(`
        INSERT INTO users (username, password, email, full_name, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, ['admin', 'admin123', 'admin@sportscoder.com', 'Administrator', 'admin', true]);
      console.log('✅ 관리자 계정 생성 완료 (admin/admin123)');
    } else {
      console.log('✅ 관리자 계정 이미 존재');
    }

    // 기본 종목 생성 (직접 SQL)
    const defaultSports = [
      ['Soccer', 'SOCCER', 'soccer', 'Football/Soccer sport', true, true],
      ['Baseball', 'BASEBALL', 'baseball', 'Baseball sport', true, true]
    ];

    for (const [name, code, template, description, is_active, is_default] of defaultSports) {
      const existingSportResult = await client.query('SELECT id FROM sports WHERE code = $1', [code]);
      
      if (existingSportResult.rows.length === 0) {
        console.log(`🏆 기본 종목 생성 중: ${name} (${code})`);
        await client.query(`
          INSERT INTO sports (name, code, template, description, is_active, is_default, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [name, code, template, description, is_active, is_default]);
        console.log(`✅ 기본 종목 생성 완료: ${name}`);
      } else {
        console.log(`✅ 기본 종목 이미 존재: ${name}`);
      }
    }

    // 기본 템플릿 생성 (직접 SQL)
    console.log('📄 기본 템플릿 생성 중...');
    const defaultTemplates = [
      ['soccer', 'SOCCER', 'overlay', 'Default soccer template', 'soccer-template.ejs', true],
      ['baseball', 'BASEBALL', 'overlay', 'Default baseball template', 'baseball-template.ejs', true]
    ];

    for (const [name, sport_type, template_type, content, file_name, is_default] of defaultTemplates) {
      const existingTemplateResult = await client.query('SELECT id FROM templates WHERE name = $1', [name]);
      
      if (existingTemplateResult.rows.length === 0) {
        console.log(`📄 기본 템플릿 생성 중: ${name}`);
        await client.query(`
          INSERT INTO templates (name, sport_type, template_type, content, file_name, is_default, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [name, sport_type, template_type, content, file_name, is_default]);
        console.log(`✅ 기본 템플릿 생성 완료: ${name}`);
      } else {
        console.log(`✅ 기본 템플릿 이미 존재: ${name}`);
      }
    }

    // 기본 설정 생성 (직접 SQL)
    console.log('⚙️ 기본 설정 생성 중...');
    const defaultSettings = [
      ['default_home_color', '#FF0000', '홈팀 기본 컬러'],
      ['default_away_color', '#0000FF', '원정팀 기본 컬러']
    ];

    for (const [key, value, description] of defaultSettings) {
      const existingSettingResult = await client.query('SELECT id FROM settings WHERE key = $1', [key]);
      
      if (existingSettingResult.rows.length === 0) {
        console.log(`⚙️ 기본 설정 생성 중: ${key}`);
        await client.query(`
          INSERT INTO settings (key, value, description, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
        `, [key, value, description]);
        console.log(`✅ 기본 설정 생성 완료: ${key}`);
      } else {
        console.log(`✅ 기본 설정 이미 존재: ${key}`);
      }
    }

    console.log('🎉 Railway PostgreSQL 데이터베이스 초기화 완료!');
    console.log('📊 생성된 데이터:');
    console.log('  - 관리자 계정: admin/admin123');
    console.log('  - 기본 종목: Soccer, Baseball');
    console.log('  - 기본 템플릿: soccer, baseball');
    console.log('  - 기본 설정: 홈팀/원정팀 컬러');

  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// Railway 환경에서만 실행
if (process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL) {
  console.log('🚀 Railway 환경 감지 - 데이터베이스 초기화 시작');
  initializeRailwayDatabase()
    .then(() => {
      console.log('✅ Railway 데이터베이스 초기화 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Railway 데이터베이스 초기화 실패:', error);
      process.exit(1);
    });
} else {
  console.log('ℹ️ 로컬 환경 - 데이터베이스 초기화 건너뜀');
}

module.exports = { initializeRailwayDatabase };
