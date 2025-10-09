#!/usr/bin/env node

const { Sequelize } = require('sequelize');

console.log('🚨 Railway PostgreSQL 완전 초기화 시작...');
console.log('==============================================');

async function completePostgreSQLReset() {
  // PostgreSQL 환경이 아니면 스크립트 종료
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('postgres')) {
    console.log('⚠️ PostgreSQL 환경이 아니므로 스크립트를 건너뜁니다.');
    return;
  }

  console.log('🔧 PostgreSQL 완전 초기화 시작...');
  console.log('📋 DATABASE_URL:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));

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
    // 1. 데이터베이스 연결 확인
    await sequelize.authenticate();
    console.log('✅ PostgreSQL 데이터베이스 연결 성공');

    // 2. 모든 테이블 완전 삭제 (CASCADE로 외래키 제약조건도 함께 삭제)
    console.log('🗑️ 모든 테이블 완전 삭제 중...');
    const tablesToDrop = [
      'SportActiveOverlayImages',
      'SportOverlayImages',
      'TeamInfo',
      'Settings',
      'MatchLists',
      'Matches',
      'UserSportPermissions',
      'Users',
      'Templates',
      'Sports'
    ];

    for (const tableName of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        console.log(`✅ 테이블 삭제: ${tableName}`);
      } catch (error) {
        console.warn(`⚠️ 테이블 삭제 실패: ${tableName} - ${error.message}`);
      }
    }

    // 3. Sports 테이블 생성 (완전한 스키마)
    console.log('🔧 Sports 테이블 생성 중...');
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
    console.log('✅ Sports 테이블 생성 완료');

    // 4. Users 테이블 생성
    console.log('🔧 Users 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "Users" (
        "id" SERIAL PRIMARY KEY,
        "username" VARCHAR(255) NOT NULL UNIQUE,
        "password" VARCHAR(255) NOT NULL,
        "role" VARCHAR(50) DEFAULT 'user',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Users 테이블 생성 완료');

    // 5. Templates 테이블 생성
    console.log('🔧 Templates 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "Templates" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "sport_code" VARCHAR(255) NOT NULL,
        "template_data" TEXT,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Templates 테이블 생성 완료');

    // 6. Matches 테이블 생성
    console.log('🔧 Matches 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "Matches" (
        "id" SERIAL PRIMARY KEY,
        "match_id" VARCHAR(255) NOT NULL UNIQUE,
        "sport_type" VARCHAR(255) NOT NULL,
        "home_team" VARCHAR(255) NOT NULL,
        "away_team" VARCHAR(255) NOT NULL,
        "home_score" INTEGER DEFAULT 0,
        "away_score" INTEGER DEFAULT 0,
        "status" VARCHAR(50) DEFAULT 'scheduled',
        "use_team_logos" BOOLEAN DEFAULT false,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Matches 테이블 생성 완료');

    // 7. TeamInfo 테이블 생성
    console.log('🔧 TeamInfo 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "TeamInfo" (
        "id" SERIAL PRIMARY KEY,
        "match_id" VARCHAR(255) NOT NULL,
        "team_name" VARCHAR(255) NOT NULL,
        "team_type" VARCHAR(50) NOT NULL,
        "team_color" VARCHAR(7) DEFAULT '#FFFFFF',
        "team_logo_path" VARCHAR(500),
        "team_logo_bg_color" VARCHAR(7) DEFAULT '#FFFFFF',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY ("match_id") REFERENCES "Matches"("match_id") ON DELETE CASCADE
      );
    `);
    console.log('✅ TeamInfo 테이블 생성 완료');

    // 8. Settings 테이블 생성
    console.log('🔧 Settings 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "Settings" (
        "id" SERIAL PRIMARY KEY,
        "match_id" VARCHAR(255) NOT NULL,
        "setting_key" VARCHAR(255) NOT NULL,
        "setting_value" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY ("match_id") REFERENCES "Matches"("match_id") ON DELETE CASCADE
      );
    `);
    console.log('✅ Settings 테이블 생성 완료');

    // 9. MatchLists 테이블 생성
    console.log('🔧 MatchLists 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "MatchLists" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ MatchLists 테이블 생성 완료');

    // 10. SportOverlayImages 테이블 생성
    console.log('🔧 SportOverlayImages 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "SportOverlayImages" (
        "id" SERIAL PRIMARY KEY,
        "sport_code" VARCHAR(255) NOT NULL,
        "image_name" VARCHAR(255) NOT NULL,
        "image_path" VARCHAR(500) NOT NULL,
        "is_active" BOOLEAN DEFAULT false,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ SportOverlayImages 테이블 생성 완료');

    // 11. SportActiveOverlayImages 테이블 생성
    console.log('🔧 SportActiveOverlayImages 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "SportActiveOverlayImages" (
        "id" SERIAL PRIMARY KEY,
        "sport_code" VARCHAR(255) NOT NULL,
        "image_path" VARCHAR(500) NOT NULL,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE("sport_code", "image_path")
      );
    `);
    console.log('✅ SportActiveOverlayImages 테이블 생성 완료');

    // 12. UserSportPermissions 테이블 생성
    console.log('🔧 UserSportPermissions 테이블 생성 중...');
    await sequelize.query(`
      CREATE TABLE "UserSportPermissions" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "sport_code" VARCHAR(255) NOT NULL,
        "permission" VARCHAR(50) DEFAULT 'read',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE
      );
    `);
    console.log('✅ UserSportPermissions 테이블 생성 완료');

    // 13. 기본 데이터 삽입
    console.log('🔧 기본 데이터 삽입 중...');

    // 기본 관리자 사용자 생성
    await sequelize.query(`
      INSERT INTO "Users" ("username", "password", "role") 
      VALUES ('admin', 'admin123', 'admin');
    `);
    console.log('✅ 기본 관리자 사용자 생성 완료');

    // 기본 스포츠 데이터 삽입
    await sequelize.query(`
      INSERT INTO "Sports" ("name", "code", "template", "description", "is_active", "is_default", "created_by") 
      VALUES 
        ('축구', 'SOCCER', 'soccer', '축구 경기', true, true, NULL),
        ('야구', 'BASEBALL', 'baseball', '야구 경기', true, true, NULL);
    `);
    console.log('✅ 기본 스포츠 데이터 삽입 완료');

    // 기본 템플릿 데이터 삽입
    await sequelize.query(`
      INSERT INTO "Templates" ("name", "sport_code", "template_data", "created_by") 
      VALUES 
        ('축구 기본 템플릿', 'SOCCER', '{"type": "soccer", "layout": "default"}', NULL),
        ('야구 기본 템플릿', 'BASEBALL', '{"type": "baseball", "layout": "default"}', NULL);
    `);
    console.log('✅ 기본 템플릿 데이터 삽입 완료');

    // 14. 최종 확인
    console.log('🔍 최종 테이블 구조 확인 중...');
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 생성된 테이블 목록:');
    tables[0].forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    // Sports 테이블 구조 확인
    const sportsSchema = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Sports'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Sports 테이블 구조:');
    sportsSchema[0].forEach(column => {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });

    // 기본 데이터 확인
    const sportsData = await sequelize.query(`SELECT * FROM "Sports";`);
    console.log('📋 기본 스포츠 데이터:');
    sportsData[0].forEach(sport => {
      console.log(`  - ${sport.name} (${sport.code}): ${sport.template}`);
    });

    const usersData = await sequelize.query(`SELECT username, role FROM "Users";`);
    console.log('📋 기본 사용자 데이터:');
    usersData[0].forEach(user => {
      console.log(`  - ${user.username} (${user.role})`);
    });

    console.log('✅ PostgreSQL 완전 초기화 완료');
    console.log('==============================================');
    
  } catch (error) {
    console.error('❌ PostgreSQL 완전 초기화 실패:', error);
    console.error('❌ 오류 상세:', error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 스크립트 실행
completePostgreSQLReset();
