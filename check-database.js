const { sequelize, TeamInfo, Match } = require('./models');

async function checkDatabase() {
  try {
    console.log('🔍 데이터베이스 연결 상태 확인 중...');
    
    // 데이터베이스 연결 테스트
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공');
    
    // TeamInfo 테이블 존재 여부 확인
    console.log('🔍 TeamInfo 테이블 존재 여부 확인 중...');
    
    try {
      // TeamInfo 테이블에 간단한 쿼리 실행
      const result = await sequelize.query('SELECT COUNT(*) FROM "TeamInfo"', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('✅ TeamInfo 테이블 존재 확인:', result);
    } catch (error) {
      console.log('❌ TeamInfo 테이블이 존재하지 않음:', error.message);
      
      // 테이블 생성 시도
      console.log('🔧 TeamInfo 테이블 생성 시도 중...');
      await TeamInfo.sync({ force: false });
      console.log('✅ TeamInfo 테이블 생성 완료');
    }
    
    // Match 테이블 존재 여부 확인
    console.log('🔍 Match 테이블 존재 여부 확인 중...');
    
    try {
      const result = await sequelize.query('SELECT COUNT(*) FROM "Matches"', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('✅ Match 테이블 존재 확인:', result);
    } catch (error) {
      console.log('❌ Match 테이블이 존재하지 않음:', error.message);
      
      // 테이블 생성 시도
      console.log('🔧 Match 테이블 생성 시도 중...');
      await Match.sync({ force: false });
      console.log('✅ Match 테이블 생성 완료');
    }
    
    // 모든 테이블 목록 확인
    console.log('🔍 데이터베이스의 모든 테이블 목록:');
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    console.log('✅ 데이터베이스 상태 확인 완료');
    
  } catch (error) {
    console.error('❌ 데이터베이스 확인 중 오류 발생:', error);
  } finally {
    await sequelize.close();
  }
}

// 스크립트 실행
checkDatabase();
