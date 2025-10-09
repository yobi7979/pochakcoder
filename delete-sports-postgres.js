const { sequelize } = require('./models');
const { Sport, Match, SportOverlayImage, SportActiveOverlayImage, TeamInfo } = require('./models');

async function deleteAllSports() {
  try {
    console.log('🔧 PostgreSQL Sports 테이블 정리 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. Railway에서 실행해주세요.');
      return;
    }
    
    // 1. 현재 등록된 모든 스포츠 조회
    console.log('🔍 현재 등록된 스포츠 조회 중...');
    const allSports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'is_default']
    });
    
    console.log(`📊 등록된 스포츠 수: ${allSports.length}개`);
    allSports.forEach(sport => {
      console.log(`- ${sport.name} (${sport.code}) - 기본: ${sport.is_default}`);
    });
    
    // 2. 기본 종목이 아닌 모든 스포츠 삭제
    console.log('🗑️ 기본 종목이 아닌 스포츠 삭제 중...');
    const customSports = allSports.filter(sport => !sport.is_default);
    
    for (const sport of customSports) {
      console.log(`🔧 ${sport.name} (${sport.code}) 삭제 중...`);
      
      try {
        // 관련 데이터 삭제
        const matchCount = await Match.count({ where: { sport_type: sport.code } });
        if (matchCount > 0) {
          await Match.destroy({ where: { sport_type: sport.code } });
          console.log(`  ✅ 관련 경기 삭제: ${matchCount}개`);
        }
        
        // 오버레이 이미지 삭제
        try {
          const overlayImageCount = await SportOverlayImage.count({ where: { sport_code: sport.code } });
          if (overlayImageCount > 0) {
            await SportOverlayImage.destroy({ where: { sport_code: sport.code } });
            console.log(`  ✅ 오버레이 이미지 삭제: ${overlayImageCount}개`);
          }
        } catch (error) {
          console.warn(`  ⚠️ 오버레이 이미지 삭제 실패: ${error.message}`);
        }
        
        // 활성 오버레이 이미지 삭제
        try {
          const activeOverlayImageCount = await SportActiveOverlayImage.count({ where: { sport_code: sport.code } });
          if (activeOverlayImageCount > 0) {
            await SportActiveOverlayImage.destroy({ where: { sport_code: sport.code } });
            console.log(`  ✅ 활성 오버레이 이미지 삭제: ${activeOverlayImageCount}개`);
          }
        } catch (error) {
          console.warn(`  ⚠️ 활성 오버레이 이미지 삭제 실패: ${error.message}`);
        }
        
        // 팀 정보 삭제
        try {
          const teamInfoCount = await TeamInfo.count({ where: { sport_type: sport.code } });
          if (teamInfoCount > 0) {
            await TeamInfo.destroy({ where: { sport_type: sport.code } });
            console.log(`  ✅ 팀 정보 삭제: ${teamInfoCount}개`);
          }
        } catch (error) {
          console.warn(`  ⚠️ 팀 정보 삭제 실패: ${error.message}`);
        }
        
        // 스포츠 삭제
        await sport.destroy();
        console.log(`  ✅ ${sport.name} 삭제 완료`);
        
      } catch (error) {
        console.error(`  ❌ ${sport.name} 삭제 실패:`, error.message);
      }
    }
    
    // 3. 삭제 후 남은 스포츠 확인
    console.log('🔍 삭제 후 남은 스포츠 확인...');
    const remainingSports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'is_default']
    });
    
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
    
    console.log('🎉 PostgreSQL Sports 테이블 정리 완료!');
    
  } catch (error) {
    console.error('❌ PostgreSQL Sports 테이블 정리 실패:', error);
    throw error;
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

if (require.main === module) {
  deleteAllSports().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = deleteAllSports;
