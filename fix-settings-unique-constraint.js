const { Client } = require('pg');

// Main DB 연결 설정
const mainConfig = {
  connectionString: 'postgresql://postgres:tmSpMARWaYwSxNpjOrDsKseXyfqrsNrY@mainline.proxy.rlwy.net:41632/railway',
  ssl: {
    rejectUnauthorized: false
  }
};

async function fixSettingsUniqueConstraint() {
  const client = new Client(mainConfig);
  
  try {
    await client.connect();
    console.log('🔌 Main DB 연결 성공');

    // 1. Settings 테이블에 key 컬럼에 대한 unique 제약조건 추가
    console.log('🔧 Settings 테이블에 unique 제약조건 추가 중...');
    
    await client.query(`
      ALTER TABLE "Settings" 
      ADD CONSTRAINT "settings_key_unique" UNIQUE ("key")
    `);
    
    console.log('✅ Settings 테이블 unique 제약조건 추가 완료');
    
    // 2. 제약조건 확인
    const constraintCheck = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'Settings' AND constraint_type = 'UNIQUE'
    `);
    
    console.log('📋 Settings 테이블 제약조건 확인:', constraintCheck.rows);
    
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️  unique 제약조건이 이미 존재합니다.');
    } else {
      console.error('❌ 오류 발생:', error.message);
    }
  } finally {
    await client.end();
    console.log('🔌 DB 연결 종료');
  }
}

fixSettingsUniqueConstraint();
