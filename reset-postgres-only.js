const { sequelize } = require('./models');
const { User, Sport, Template } = require('./models');

async function resetPostgresOnly() {
  try {
    console.log('🔧 PostgreSQL 전용 스키마 초기화 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. 스크립트를 종료합니다.');
      return;
    }
    
    console.log('🗑️ PostgreSQL 테이블 삭제 중...');
    
    // PostgreSQL 전용 테이블 삭제
    const dropQueries = [
      'DROP TABLE IF EXISTS "SportActiveOverlayImages" CASCADE;',
      'DROP TABLE IF EXISTS "SportOverlayImages" CASCADE;',
      'DROP TABLE IF EXISTS "TeamInfo" CASCADE;',
      'DROP TABLE IF EXISTS "Matches" CASCADE;',
      'DROP TABLE IF EXISTS "MatchLists" CASCADE;',
      'DROP TABLE IF EXISTS "Settings" CASCADE;',
      'DROP TABLE IF EXISTS "templates" CASCADE;',
      'DROP TABLE IF EXISTS "Sports" CASCADE;',
      'DROP TABLE IF EXISTS "users" CASCADE;',
      'DROP TABLE IF EXISTS "user_sessions" CASCADE;'
    ];
    
    for (const query of dropQueries) {
      try {
        await sequelize.query(query);
        console.log(`✅ 쿼리 실행: ${query.split(' ')[2]}`);
      } catch (error) {
        console.warn(`⚠️ 쿼리 실행 실패: ${error.message}`);
      }
    }
    
    console.log('🔨 PostgreSQL 테이블 재생성 중...');
    await sequelize.sync({ force: true });
    console.log('✅ PostgreSQL 테이블 재생성 완료');
    
    console.log('📝 기본 데이터 삽입 중...');
    
    // 관리자 사용자 생성
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123',
      email: 'admin@sportscoder.com',
      full_name: '관리자',
      role: 'admin',
      is_active: true
    });
    console.log('✅ 관리자 사용자 생성 완료');
    
    // 기본 스포츠 생성
    const soccer = await Sport.create({
      name: '축구',
      code: 'SOCCER',
      template: 'soccer',
      description: '축구 경기',
      is_active: true,
      is_default: true
    });
    
    const baseball = await Sport.create({
      name: '야구', 
      code: 'BASEBALL',
      template: 'baseball',
      description: '야구 경기',
      is_active: true,
      is_default: true
    });
    console.log('✅ 기본 스포츠 생성 완료');
    
    // 기본 템플릿 생성
    const soccerTemplate = await Template.create({
      name: 'soccer',
      sport_type: 'SOCCER',
      template_type: 'overlay',
      content: '축구 오버레이 템플릿',
      file_name: 'soccer-template.ejs',
      is_default: true,
      created_by: adminUser.id
    });
    
    const baseballTemplate = await Template.create({
      name: 'baseball',
      sport_type: 'BASEBALL', 
      template_type: 'overlay',
      content: '야구 오버레이 템플릿',
      file_name: 'baseball-template.ejs',
      is_default: true,
      created_by: adminUser.id
    });
    console.log('✅ 기본 템플릿 생성 완료');
    
    console.log('🎉 PostgreSQL 스키마 초기화 완료!');
    console.log('📊 생성된 데이터:');
    console.log(`- 사용자: 1명 (admin)`);
    console.log(`- 스포츠: 2개 (축구, 야구)`);
    console.log(`- 템플릿: 2개 (soccer, baseball)`);
    
  } catch (error) {
    console.error('❌ PostgreSQL 스키마 초기화 실패:', error);
    throw error;
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// 스크립트 실행
if (require.main === module) {
  resetPostgresOnly().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = resetPostgresOnly;
