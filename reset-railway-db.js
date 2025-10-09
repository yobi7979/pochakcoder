const { Client } = require('pg');

async function resetDatabase() {
  const client = new Client({
    connectionString: 'postgresql://postgres:CotGGjFCLAlcJUbxffpPsRTFhLXFkLBW@postgres.railway.internal:5432/railway'
  });

  try {
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    console.log('🗑️ 모든 테이블 삭제 중...');
    await client.query('DROP SCHEMA public CASCADE');
    console.log('✅ 스키마 삭제 완료');

    console.log('🔄 새로운 스키마 생성 중...');
    await client.query('CREATE SCHEMA public');
    console.log('✅ 스키마 생성 완료');

    console.log('🔐 권한 설정 중...');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ 권한 설정 완료');

    console.log('🎉 데이터베이스 초기화 완료!');
    console.log('📝 이제 서버를 재시작하면 자동으로 새로운 스키마가 생성됩니다.');

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await client.end();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

resetDatabase();
