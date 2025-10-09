const { sequelize } = require('./models');
const { User, Sport, Template } = require('./models');

async function simpleDbReset() {
  try {
    console.log('🔧 간단한 DB 초기화 시작...');
    
    // 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    // 1. 모든 테이블 삭제 후 재생성
    console.log('🗑️ 모든 테이블 삭제 중...');
    await sequelize.sync({ force: true });
    console.log('✅ 테이블 재생성 완료');
    
    // 2. 기본 데이터 생성
    console.log('📝 기본 데이터 생성 중...');
    
    // 관리자 사용자
    const admin = await User.create({
      username: 'admin',
      password: 'admin123',
      email: 'admin@sportscoder.com',
      full_name: '관리자',
      role: 'admin',
      is_active: true
    });
    console.log('✅ 관리자 사용자 생성 완료');
    
    // 기본 스포츠
    await Sport.create({
      name: '축구',
      code: 'SOCCER',
      template: 'soccer',
      description: '축구 경기',
      is_active: true,
      is_default: true
    });
    
    await Sport.create({
      name: '야구',
      code: 'BASEBALL',
      template: 'baseball',
      description: '야구 경기',
      is_active: true,
      is_default: true
    });
    console.log('✅ 기본 스포츠 생성 완료');
    
    // 기본 템플릿
    await Template.create({
      name: 'soccer',
      sport_type: 'SOCCER',
      template_type: 'overlay',
      content: '축구 오버레이 템플릿',
      file_name: 'soccer-template.ejs',
      is_default: true,
      created_by: admin.id
    });
    
    await Template.create({
      name: 'baseball',
      sport_type: 'BASEBALL',
      template_type: 'overlay',
      content: '야구 오버레이 템플릿',
      file_name: 'baseball-template.ejs',
      is_default: true,
      created_by: admin.id
    });
    console.log('✅ 기본 템플릿 생성 완료');
    
    console.log('🎉 DB 초기화 완료!');
    console.log('📊 생성된 데이터:');
    console.log('- 사용자: admin/admin123');
    console.log('- 스포츠: 축구, 야구');
    console.log('- 템플릿: soccer, baseball');
    
  } catch (error) {
    console.error('❌ DB 초기화 실패:', error);
    throw error;
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

if (require.main === module) {
  simpleDbReset().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = simpleDbReset;
