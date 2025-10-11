const { sequelize, TeamInfo, Match } = require('./models');

async function fixDatabase() {
  try {
    console.log('🔧 Railway 데이터베이스 문제 해결 시작...');
    
    // 데이터베이스 연결 테스트
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 모든 테이블 강제 동기화
    console.log('🔧 모든 테이블 동기화 시작...');
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ 모든 테이블 동기화 완료');
    
    // TeamInfo 테이블 특별 처리
    console.log('🔧 TeamInfo 테이블 특별 처리...');
    try {
      await TeamInfo.sync({ force: false });
      console.log('✅ TeamInfo 테이블 동기화 완료');
    } catch (error) {
      console.log('⚠️ TeamInfo 테이블 동기화 실패:', error.message);
      
      // 테이블이 존재하지 않는 경우 강제 생성
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS "TeamInfo" (
            "id" SERIAL PRIMARY KEY,
            "match_id" VARCHAR(255) NOT NULL,
            "sport_type" VARCHAR(50) NOT NULL DEFAULT 'SOCCER',
            "team_name" VARCHAR(255) NOT NULL,
            "team_type" VARCHAR(10) NOT NULL,
            "team_color" VARCHAR(7) DEFAULT '#000000',
            "team_header" VARCHAR(255),
            "logo_path" VARCHAR(500),
            "logo_bg_color" VARCHAR(7) DEFAULT '#FFFFFF',
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        console.log('✅ TeamInfo 테이블 강제 생성 완료');
      } catch (createError) {
        console.error('❌ TeamInfo 테이블 강제 생성 실패:', createError);
      }
    }
    
    // Match 테이블 특별 처리
    console.log('🔧 Match 테이블 특별 처리...');
    try {
      await Match.sync({ force: false });
      console.log('✅ Match 테이블 동기화 완료');
    } catch (error) {
      console.log('⚠️ Match 테이블 동기화 실패:', error.message);
    }
    
    // 테이블 존재 여부 최종 확인
    console.log('🔍 테이블 존재 여부 최종 확인...');
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📋 데이터베이스 테이블 목록:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // TeamInfo 테이블 테스트
    try {
      const testQuery = await sequelize.query('SELECT COUNT(*) FROM "TeamInfo"', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('✅ TeamInfo 테이블 접근 테스트 성공:', testQuery);
    } catch (error) {
      console.log('❌ TeamInfo 테이블 접근 테스트 실패:', error.message);
    }
    
    console.log('✅ Railway 데이터베이스 문제 해결 완료');
    
  } catch (error) {
    console.error('❌ 데이터베이스 문제 해결 실패:', error);
  } finally {
    await sequelize.close();
  }
}

// 스크립트 실행
fixDatabase();
