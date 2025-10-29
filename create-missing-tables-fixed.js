const { Client } = require('pg');

// Main DB 연결 정보
const mainConfig = {
  connectionString: "postgresql://postgres:tmSpMARWaYwSxNpjOrDsKseXyfqrsNrY@mainline.proxy.rlwy.net:41632/railway"
};

// Stage DB 연결 정보
const stageConfig = {
  connectionString: "postgresql://postgres:REFuHuwHQbeBzRUuBuDopgLcdgIvocFo@trolley.proxy.rlwy.net:44142/railway"
};

async function createMissingTablesFixed() {
  const mainClient = new Client(mainConfig);
  const stageClient = new Client(stageConfig);
  
  try {
    console.log('🔌 DB 연결 중...');
    await mainClient.connect();
    await stageClient.connect();
    console.log('✅ DB 연결 성공');
    
    // 1. templates 테이블 생성
    console.log('\n🔨 templates 테이블 생성 중...');
    const templatesQuery = `
      CREATE TABLE IF NOT EXISTS "templates" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "sport_type" VARCHAR(255) NOT NULL,
        "template_type" VARCHAR(50) NOT NULL,
        "content" TEXT NOT NULL,
        "file_name" VARCHAR(255),
        "is_default" BOOLEAN DEFAULT false,
        "created_by" INTEGER,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await mainClient.query(templatesQuery);
    console.log('✅ templates 테이블 생성 완료');
    
    // 2. user_sessions 테이블 생성
    console.log('\n🔨 user_sessions 테이블 생성 중...');
    const userSessionsQuery = `
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" VARCHAR NOT NULL PRIMARY KEY,
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP WITHOUT TIME ZONE NOT NULL
      );
    `;
    
    await mainClient.query(userSessionsQuery);
    console.log('✅ user_sessions 테이블 생성 완료');
    
    // 3. users 테이블 생성 (enum 타입을 VARCHAR로 변경)
    console.log('\n🔨 users 테이블 생성 중...');
    const usersQuery = `
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "username" VARCHAR(50) NOT NULL UNIQUE,
        "password" VARCHAR(255) NOT NULL,
        "email" VARCHAR(100),
        "full_name" VARCHAR(100),
        "role" VARCHAR(20) NOT NULL DEFAULT 'user',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "last_login" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await mainClient.query(usersQuery);
    console.log('✅ users 테이블 생성 완료');
    
    // 4. 데이터 마이그레이션
    console.log('\n📥 데이터 마이그레이션 시작...');
    
    // templates 데이터
    try {
      const templatesData = await stageClient.query('SELECT * FROM "templates"');
      if (templatesData.rows.length > 0) {
        console.log(`📥 templates에 ${templatesData.rows.length}개 레코드 삽입 중...`);
        for (const row of templatesData.rows) {
          const insertQuery = `
            INSERT INTO "templates" (name, sport_type, template_type, content, file_name, is_default, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING;
          `;
          await mainClient.query(insertQuery, [
            row.name, row.sport_type, row.template_type, row.content, 
            row.file_name, row.is_default, row.created_by, row.created_at, row.updated_at
          ]);
        }
        console.log('✅ templates 데이터 삽입 완료');
      }
    } catch (error) {
      console.log(`⚠️  templates 데이터 삽입 오류: ${error.message}`);
    }
    
    // user_sessions 데이터
    try {
      const sessionsData = await stageClient.query('SELECT * FROM "user_sessions"');
      if (sessionsData.rows.length > 0) {
        console.log(`📥 user_sessions에 ${sessionsData.rows.length}개 레코드 삽입 중...`);
        for (const row of sessionsData.rows) {
          const insertQuery = `
            INSERT INTO "user_sessions" (sid, sess, expire)
            VALUES ($1, $2, $3)
            ON CONFLICT (sid) DO NOTHING;
          `;
          await mainClient.query(insertQuery, [row.sid, JSON.stringify(row.sess), row.expire]);
        }
        console.log('✅ user_sessions 데이터 삽입 완료');
      }
    } catch (error) {
      console.log(`⚠️  user_sessions 데이터 삽입 오류: ${error.message}`);
    }
    
    // users 데이터
    try {
      const usersData = await stageClient.query('SELECT * FROM "users"');
      if (usersData.rows.length > 0) {
        console.log(`📥 users에 ${usersData.rows.length}개 레코드 삽입 중...`);
        for (const row of usersData.rows) {
          const insertQuery = `
            INSERT INTO "users" (id, username, password, email, full_name, role, is_active, last_login, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING;
          `;
          await mainClient.query(insertQuery, [
            row.id, row.username, row.password, row.email, row.full_name,
            row.role, row.is_active, row.last_login, row.created_at, row.updated_at
          ]);
        }
        console.log('✅ users 데이터 삽입 완료');
      }
    } catch (error) {
      console.log(`⚠️  users 데이터 삽입 오류: ${error.message}`);
    }
    
    console.log('\n🎉 누락된 테이블 및 데이터 생성 완료!');
    
    // 최종 확인
    console.log('\n📊 최종 테이블 상태 확인...');
    const finalCheck = await mainClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const allTables = finalCheck.rows.map(row => row.table_name);
    console.log('📋 모든 테이블:', allTables);
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await mainClient.end();
    await stageClient.end();
    console.log('🔌 DB 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  createMissingTablesFixed().catch(console.error);
}

module.exports = { createMissingTablesFixed };
