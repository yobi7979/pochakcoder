const { Client } = require('pg');

// Main DB 연결 정보
const mainConfig = {
  connectionString: "postgresql://postgres:tmSpMARWaYwSxNpjOrDsKseXyfqrsNrY@mainline.proxy.rlwy.net:41632/railway"
};

async function checkMainDBTables() {
  const mainClient = new Client(mainConfig);
  
  try {
    console.log('🔌 Main DB 연결 중...');
    await mainClient.connect();
    console.log('✅ Main DB 연결 성공');
    
    // 현재 테이블 목록 조회
    console.log('📋 Main DB 테이블 목록 조회 중...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await mainClient.query(tablesQuery);
    const currentTables = tablesResult.rows.map(row => row.table_name);
    console.log('📊 현재 Main DB 테이블:', currentTables);
    
    // Stage DB에서 백업한 테이블 목록
    const expectedTables = [
      'MatchLists',
      'MatchTeamLogos', 
      'Matches',
      'Settings',
      'SportActiveOverlayImages',
      'SportOverlayImages',
      'Sports',
      'TeamInfo',
      'TeamLogos',
      'UserSportPermissions',
      'templates',
      'user_sessions',
      'users'
    ];
    
    console.log('\n🔍 누락된 테이블 확인 중...');
    const missingTables = expectedTables.filter(table => !currentTables.includes(table));
    
    if (missingTables.length === 0) {
      console.log('✅ 모든 테이블이 존재합니다!');
    } else {
      console.log('❌ 누락된 테이블들:');
      missingTables.forEach(table => console.log(`  - ${table}`));
      
      console.log('\n📋 존재하는 테이블들:');
      currentTables.forEach(table => console.log(`  ✅ ${table}`));
    }
    
    // 각 테이블의 레코드 수 확인
    console.log('\n📊 각 테이블의 레코드 수:');
    for (const table of currentTables) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${table}";`;
        const countResult = await mainClient.query(countQuery);
        console.log(`  ${table}: ${countResult.rows[0].count}개 레코드`);
      } catch (error) {
        console.log(`  ${table}: 조회 오류 - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ DB 확인 오류:', error);
  } finally {
    await mainClient.end();
    console.log('🔌 DB 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  checkMainDBTables().catch(console.error);
}

module.exports = { checkMainDBTables };
