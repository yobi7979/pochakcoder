const { sequelize } = require('./models');

async function forceDeleteSports() {
  try {
    console.log('🔧 PostgreSQL 강제 스포츠 삭제 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. Railway에서 실행해주세요.');
      return;
    }
    
    // 1. 현재 스포츠 조회
    console.log('🔍 현재 스포츠 조회 중...');
    const [sports] = await sequelize.query(`
      SELECT id, name, code, is_default 
      FROM "Sports" 
      ORDER BY id
    `);
    
    console.log(`📊 등록된 스포츠 수: ${sports.length}개`);
    sports.forEach(sport => {
      console.log(`- ${sport.name} (${sport.code}) - 기본: ${sport.is_default}`);
    });
    
    // 2. 기본 종목이 아닌 스포츠만 삭제
    const customSports = sports.filter(sport => !sport.is_default);
    console.log(`🗑️ 삭제할 스포츠 수: ${customSports.length}개`);
    
    for (const sport of customSports) {
      console.log(`🔧 ${sport.name} (${sport.code}) 강제 삭제 중...`);
      
      try {
        // 1. 관련 데이터 삭제 (CASCADE로 자동 삭제되지만 명시적으로)
        await sequelize.query(`
          DELETE FROM "Matches" WHERE sport_type = '${sport.code}'
        `);
        console.log(`  ✅ 관련 경기 삭제 완료`);
        
        await sequelize.query(`
          DELETE FROM "SportOverlayImages" WHERE sport_code = '${sport.code}'
        `);
        console.log(`  ✅ 오버레이 이미지 삭제 완료`);
        
        await sequelize.query(`
          DELETE FROM "SportActiveOverlayImages" WHERE sport_code = '${sport.code}'
        `);
        console.log(`  ✅ 활성 오버레이 이미지 삭제 완료`);
        
        await sequelize.query(`
          DELETE FROM "TeamInfo" WHERE sport_type = '${sport.code}'
        `);
        console.log(`  ✅ 팀 정보 삭제 완료`);
        
        // 2. 스포츠 삭제
        await sequelize.query(`
          DELETE FROM "Sports" WHERE code = '${sport.code}'
        `);
        console.log(`  ✅ ${sport.name} 삭제 완료`);
        
      } catch (error) {
        console.error(`  ❌ ${sport.name} 삭제 실패:`, error.message);
      }
    }
    
    // 3. 삭제 후 확인
    console.log('🔍 삭제 후 스포츠 확인...');
    const [remainingSports] = await sequelize.query(`
      SELECT id, name, code, is_default 
      FROM "Sports" 
      ORDER BY id
    `);
    
    console.log(`📊 남은 스포츠 수: ${remainingSports.length}개`);
    remainingSports.forEach(sport => {
      console.log(`- ${sport.name} (${sport.code}) - 기본: ${sport.is_default}`);
    });
    
    // 4. 기본 스포츠만 남았는지 확인
    const nonDefaultSports = remainingSports.filter(sport => !sport.is_default);
    if (nonDefaultSports.length > 0) {
      console.log('⚠️ 아직 기본 종목이 아닌 스포츠가 남아있습니다:');
      nonDefaultSports.forEach(sport => {
        console.log(`- ${sport.name} (${sport.code})`);
      });
    } else {
      console.log('✅ 모든 기본 종목이 아닌 스포츠가 삭제되었습니다.');
    }
    
    console.log('🎉 PostgreSQL 강제 스포츠 삭제 완료!');
    
  } catch (error) {
    console.error('❌ PostgreSQL 강제 스포츠 삭제 실패:', error);
    throw error;
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

if (require.main === module) {
  forceDeleteSports().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = forceDeleteSports;
