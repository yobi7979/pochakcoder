const { Client } = require('pg');

// Railway 배포용 단순한 DB 초기화 스크립트 (주석 처리됨)
async function initializeDatabase() {
  console.log('🚀 Railway DB 초기화 시작...');
  
  // DB 초기화 코드 주석 처리 - 배포 시 기존 데이터 보존
  console.log('⚠️ DB 초기화가 주석 처리되어 있습니다. 기존 데이터가 보존됩니다.');
  return;
  
  /*
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. 데이터베이스 연결
    console.log('🔗 DB 연결 중...');
    await client.connect();
    console.log('✅ DB 연결 성공');

    // 2. 기존 스키마 완전 삭제
    console.log('🗑️ 기존 스키마 삭제 중...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    console.log('✅ 기존 스키마 삭제 완료');

    // 3. 새로운 스키마 생성
    console.log('🔄 새 스키마 생성 중...');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ 새 스키마 생성 완료');

    // 4. 필수 테이블 생성
    console.log('📊 필수 테이블 생성 중...');
    
    // users 테이블
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        full_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ users 테이블 생성');

    // Sports 테이블
    await client.query(`
      CREATE TABLE "Sports" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        template VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Sports 테이블 생성');

    // templates 테이블
    await client.query(`
      CREATE TABLE templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sport_type VARCHAR(50),
        template_type VARCHAR(50),
        content TEXT,
        file_name VARCHAR(255),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ templates 테이블 생성');

    // Settings 테이블
    await client.query(`
      CREATE TABLE "Settings" (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Settings 테이블 생성');

    // Matches 테이블
    await client.query(`
      CREATE TABLE "Matches" (
        id VARCHAR(50) PRIMARY KEY,
        sport_type VARCHAR(50) NOT NULL,
        home_team VARCHAR(255) NOT NULL,
        away_team VARCHAR(255) NOT NULL,
        home_team_color VARCHAR(7),
        away_team_color VARCHAR(7),
        home_team_header VARCHAR(255),
        away_team_header VARCHAR(255),
        home_score INTEGER DEFAULT 0,
        away_score INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        match_data JSONB,
        created_by INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Matches 테이블 생성');

    // TeamInfo 테이블
    await client.query(`
      CREATE TABLE "TeamInfo" (
        id SERIAL PRIMARY KEY,
        match_id VARCHAR(50),
        sport_type VARCHAR(50) DEFAULT 'SOCCER',
        team_name VARCHAR(255) NOT NULL,
        team_type VARCHAR(10) NOT NULL,
        team_color VARCHAR(7) DEFAULT '#000000',
        team_header VARCHAR(255),
        logo_path VARCHAR(500),
        logo_bg_color VARCHAR(7) DEFAULT '#FFFFFF',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ TeamInfo 테이블 생성');

    // MatchLists 테이블
    await client.query(`
      CREATE TABLE "MatchLists" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        matches JSONB DEFAULT '[]',
        custom_url VARCHAR(500),
        pushed_match_id VARCHAR(50),
        pushed_match_index INTEGER DEFAULT 0,
        pushed_timestamp BIGINT,
        created_by INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ MatchLists 테이블 생성');

    // SportOverlayImages 테이블
    await client.query(`
      CREATE TABLE "SportOverlayImages" (
        id SERIAL PRIMARY KEY,
        sport_code VARCHAR(50) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ SportOverlayImages 테이블 생성');

    // SportActiveOverlayImages 테이블
    await client.query(`
      CREATE TABLE "SportActiveOverlayImages" (
        id SERIAL PRIMARY KEY,
        sport_code VARCHAR(50) NOT NULL,
        active_image_id INTEGER,
        active_image_path VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(sport_code, active_image_id)
      )
    `);
    console.log('✅ SportActiveOverlayImages 테이블 생성');

    // UserSportPermissions 테이블
    await client.query(`
      CREATE TABLE "UserSportPermissions" (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sport_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, sport_id)
      )
    `);
    console.log('✅ UserSportPermissions 테이블 생성');

    // 5. 기본 데이터 생성
    console.log('🌱 기본 데이터 생성 중...');
    
    // 관리자 계정 생성
    await client.query(`
      INSERT INTO users (username, password, email, full_name, role, is_active)
      VALUES ('admin', 'admin123', 'admin@sportscoder.com', 'Administrator', 'admin', true)
      ON CONFLICT (username) DO NOTHING
    `);
    console.log('✅ 관리자 계정 생성 (admin/admin123)');

    // 기본 종목 생성
    await client.query(`
      INSERT INTO "Sports" (name, code, template, description, is_active, is_default)
      VALUES 
        ('Soccer', 'SOCCER', 'soccer', 'Football/Soccer sport', true, true),
        ('Baseball', 'BASEBALL', 'baseball', 'Baseball sport', true, true)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('✅ 기본 종목 생성 (Soccer, Baseball)');

    // 기본 템플릿 생성
    await client.query(`
      INSERT INTO templates (name, sport_type, template_type, content, file_name, is_default)
      VALUES 
        ('soccer', 'SOCCER', 'overlay', 'Default soccer template', 'soccer-template.ejs', true),
        ('baseball', 'BASEBALL', 'overlay', 'Default baseball template', 'baseball-template.ejs', true)
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ 기본 템플릿 생성');

    // 기본 설정 생성
    await client.query(`
      INSERT INTO "Settings" (key, value, description)
      VALUES 
        ('default_home_color', '#FF0000', '홈팀 기본 컬러'),
        ('default_away_color', '#0000FF', '원정팀 기본 컬러')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('✅ 기본 설정 생성');

    console.log('🎉 Railway DB 초기화 완료!');
    console.log('📊 생성된 테이블: users, Sports, templates, Settings, Matches, TeamInfo, MatchLists, SportOverlayImages, SportActiveOverlayImages, UserSportPermissions');
    console.log('👤 관리자 계정: admin/admin123');

  } catch (error) {
    console.error('❌ DB 초기화 실패:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 DB 연결 종료');
  }
}

// Railway 환경에서만 실행 (주석 처리됨)
/*
if (process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL) {
  console.log('🚀 Railway 환경 감지 - DB 초기화 시작');
  initializeDatabase()
    .then(() => {
      console.log('✅ Railway DB 초기화 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Railway DB 초기화 실패:', error);
      process.exit(1);
    });
} else {
  console.log('ℹ️ 로컬 환경 - DB 초기화 건너뜀');
}
*/

// DB 초기화 비활성화 - 기존 데이터 보존
console.log('ℹ️ DB 초기화가 비활성화되어 있습니다. 기존 데이터가 보존됩니다.');

module.exports = { initializeDatabase };

// Railway 배포 스크립트 실행
if (require.main === module) {
    console.log('🚀 Railway 배포 스크립트 시작...');
    initializeDatabase()
        .then(() => {
            console.log('✅ Railway 배포 준비 완료');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Railway 배포 중 오류 발생:', error);
            process.exit(1);
        });
}