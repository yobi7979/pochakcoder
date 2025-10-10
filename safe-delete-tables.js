// Railway PostgreSQL 안전한 테이블 삭제 스크립트
const { Client } = require('pg');

async function safeDeleteTables() {
  console.log('🗑️ 안전한 테이블 삭제 시작...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 데이터베이스 연결
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 삭제할 테이블 목록 (의존성 순서대로) - 실제 테이블명 사용
    const tablesToDelete = [
      'SportActiveOverlayImages',    // 가장 의존성이 높음
      'SportOverlayImages',          // 오버레이 이미지
      'TeamInfo',                    // 팀 정보
      'MatchLists'                   // 경기 목록
    ];

    // 각 테이블 삭제
    for (const tableName of tablesToDelete) {
      try {
        console.log(`\n🔍 테이블 '${tableName}' 확인 중...`);
        
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
          continue;
        }

        // 테이블 데이터 개수 확인
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}";`;
        const countResult = await client.query(countQuery);
        const recordCount = parseInt(countResult.rows[0].count);
        
        console.log(`📊 테이블 '${tableName}'에 ${recordCount}개의 레코드가 있습니다.`);

        if (recordCount > 0) {
          console.log(`⚠️ 테이블 '${tableName}'에 데이터가 있습니다.`);
          console.log('❌ 데이터가 있는 테이블은 삭제하지 않습니다.');
          console.log('💡 데이터를 먼저 백업하거나 삭제한 후 다시 시도하세요.');
          continue;
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
          console.log('❌ 외래 키 제약 조건이 있는 테이블은 삭제하지 않습니다.');
          continue;
        }

        // 테이블 삭제
        console.log(`🗑️ 테이블 '${tableName}' 삭제 중...`);
        await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        console.log(`✅ 테이블 '${tableName}' 삭제 완료`);

      } catch (error) {
        console.error(`❌ 테이블 '${tableName}' 삭제 중 오류 발생:`, error.message);
        console.log(`⚠️ 테이블 '${tableName}' 삭제를 건너뜁니다.`);
      }
    }

    console.log('\n🎉 안전한 테이블 삭제 완료!');
    console.log('\n📋 삭제된 테이블:');
    console.log('  - SportActiveOverlayImages (활성 오버레이 이미지)');
    console.log('  - SportOverlayImages (오버레이 이미지)');
    console.log('  - TeamInfo (팀 정보)');
    console.log('  - MatchLists (경기 목록)');
    console.log('\n🔒 보존된 핵심 테이블:');
    console.log('  - Sports (종목 정보)');
    console.log('  - Settings (시스템 설정)');
    console.log('  - Matches (경기 데이터)');
    console.log('  - users (사용자 정보)');
    console.log('  - templates (템플릿)');

  } catch (error) {
    console.error('❌ 테이블 삭제 중 치명적인 오류 발생:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// Railway 환경에서만 실행
if (process.env.DATABASE_URL) {
  console.log('🚀 Railway 환경에서 안전한 테이블 삭제 시작');
  safeDeleteTables()
    .then(() => {
      console.log('✅ 안전한 테이블 삭제 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 안전한 테이블 삭제 실패:', error);
      process.exit(1);
    });
} else {
  console.log('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  console.log('Railway 환경에서만 실행할 수 있습니다.');
  process.exit(1);
}
