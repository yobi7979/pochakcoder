const { sequelize } = require('./models');
const { QueryTypes } = require('sequelize');

async function migrateDatabase() {
  try {
    console.log('데이터베이스 마이그레이션 시작...');
    
    // 데이터베이스 연결 확인
    await sequelize.authenticate();
    console.log('데이터베이스 연결 성공');

    // Matches 테이블에 created_by 컬럼 추가
    try {
      await sequelize.query(`
        ALTER TABLE Matches ADD COLUMN created_by INTEGER;
      `, { type: QueryTypes.RAW });
      console.log('✅ Matches 테이블에 created_by 컬럼 추가 완료');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️  Matches 테이블의 created_by 컬럼이 이미 존재합니다.');
      } else {
        console.error('❌ Matches 테이블 created_by 컬럼 추가 실패:', error.message);
      }
    }

    // MatchLists 테이블에 created_by 컬럼 추가
    try {
      await sequelize.query(`
        ALTER TABLE MatchLists ADD COLUMN created_by INTEGER;
      `, { type: QueryTypes.RAW });
      console.log('✅ MatchLists 테이블에 created_by 컬럼 추가 완료');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️  MatchLists 테이블의 created_by 컬럼이 이미 존재합니다.');
      } else {
        console.error('❌ MatchLists 테이블 created_by 컬럼 추가 실패:', error.message);
      }
    }

    // 기존 데이터에 created_by 값 설정 (관리자 ID로)
    try {
      await sequelize.query(`
        UPDATE Matches SET created_by = 1 WHERE created_by IS NULL;
      `, { type: QueryTypes.RAW });
      console.log('✅ 기존 경기 데이터에 created_by 값 설정 완료');
    } catch (error) {
      console.error('❌ 기존 경기 데이터 업데이트 실패:', error.message);
    }

    try {
      await sequelize.query(`
        UPDATE MatchLists SET created_by = 1 WHERE created_by IS NULL;
      `, { type: QueryTypes.RAW });
      console.log('✅ 기존 리스트 데이터에 created_by 값 설정 완료');
    } catch (error) {
      console.error('❌ 기존 리스트 데이터 업데이트 실패:', error.message);
    }

    console.log('🎉 데이터베이스 마이그레이션 완료!');

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
  } finally {
    await sequelize.close();
  }
}

// 스크립트 실행
migrateDatabase();
