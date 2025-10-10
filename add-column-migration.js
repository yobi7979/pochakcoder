const { Client } = require('pg');

// DB 컬럼 추가 마이그레이션 스크립트
async function addColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:CotGGjFCLAlcJUbxffpPsRTFhLXFkLBW@postgres.railway.internal:5432/railway'
  });

  try {
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 1. users 테이블에 컬럼 추가 예시
    console.log('👤 users 테이블 컬럼 추가 중...');
    
    // last_login 컬럼 추가 (이미 존재할 수 있음)
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE
      `);
      console.log('✅ last_login 컬럼 추가 완료');
    } catch (error) {
      console.log('⚠️ last_login 컬럼이 이미 존재하거나 추가 실패:', error.message);
    }

    // 2. matches 테이블에 컬럼 추가 예시
    console.log('🏆 matches 테이블 컬럼 추가 중...');
    
    // match_date 컬럼 추가
    try {
      await client.query(`
        ALTER TABLE "Matches" 
        ADD COLUMN IF NOT EXISTS match_date TIMESTAMP WITH TIME ZONE
      `);
      console.log('✅ match_date 컬럼 추가 완료');
    } catch (error) {
      console.log('⚠️ match_date 컬럼이 이미 존재하거나 추가 실패:', error.message);
    }

    // 3. sports 테이블에 컬럼 추가 예시
    console.log('⚽ sports 테이블 컬럼 추가 중...');
    
    // is_default 컬럼 추가
    try {
      await client.query(`
        ALTER TABLE "Sports" 
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false
      `);
      console.log('✅ is_default 컬럼 추가 완료');
    } catch (error) {
      console.log('⚠️ is_default 컬럼이 이미 존재하거나 추가 실패:', error.message);
    }

    // 4. 새로운 테이블 생성 예시
    console.log('📊 새로운 테이블 생성 중...');
    
    // UserSportPermissions 테이블 생성
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "UserSportPermissions" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "sport_id" INTEGER NOT NULL,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE("user_id", "sport_id")
        )
      `);
      console.log('✅ UserSportPermissions 테이블 생성 완료');
    } catch (error) {
      console.log('⚠️ UserSportPermissions 테이블이 이미 존재하거나 생성 실패:', error.message);
    }

    // 5. 인덱스 추가 예시
    console.log('🔍 인덱스 추가 중...');
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
      `);
      console.log('✅ username 인덱스 추가 완료');
    } catch (error) {
      console.log('⚠️ username 인덱스가 이미 존재하거나 추가 실패:', error.message);
    }

    console.log('🎉 DB 컬럼 추가 마이그레이션 완료!');

  } catch (error) {
    console.error('❌ 마이그레이션 오류 발생:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  addColumns()
    .then(() => {
      console.log('✅ 마이그레이션 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 마이그레이션 실패:', error);
      process.exit(1);
    });
}

module.exports = { addColumns };
