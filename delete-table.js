// Railway PostgreSQL 특정 테이블 삭제 스크립트
const { Client } = require('pg');

async function deleteTable(tableName) {
  console.log(`🗑️ 테이블 삭제 시작: ${tableName}`);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 데이터베이스 연결
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 테이블 존재 여부 확인
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      );
    `;
    
    const tableExists = await client.query(tableExistsQuery, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      console.log(`⚠️ 테이블 '${tableName}'이 존재하지 않습니다.`);
      return;
    }

    // 외래 키 제약 조건 확인
    const foreignKeysQuery = `
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND (tc.table_name = $1 OR ccu.table_name = $1);
    `;
    
    const foreignKeys = await client.query(foreignKeysQuery, [tableName]);
    
    if (foreignKeys.rows.length > 0) {
      console.log(`⚠️ 테이블 '${tableName}'에 외래 키 제약 조건이 있습니다:`);
      foreignKeys.rows.forEach(fk => {
        console.log(`  - ${fk.constraint_name}: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
      console.log('⚠️ 외래 키 제약 조건을 먼저 해제해야 합니다.');
      return;
    }

    // 테이블 삭제
    console.log(`🗑️ 테이블 '${tableName}' 삭제 중...`);
    await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
    console.log(`✅ 테이블 '${tableName}' 삭제 완료`);

  } catch (error) {
    console.error('❌ 테이블 삭제 중 오류 발생:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// 명령행 인수로 테이블명 받기
const tableName = process.argv[2];

if (!tableName) {
  console.log('사용법: node delete-table.js <테이블명>');
  console.log('예시: node delete-table.js TeamInfo');
  process.exit(1);
}

// Railway 환경에서만 실행
if (process.env.DATABASE_URL) {
  console.log('🚀 Railway 환경에서 테이블 삭제 시작');
  deleteTable(tableName)
    .then(() => {
      console.log('✅ 테이블 삭제 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 테이블 삭제 실패:', error);
      process.exit(1);
    });
} else {
  console.log('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  console.log('Railway 환경에서만 실행할 수 있습니다.');
  process.exit(1);
}
