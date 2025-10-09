const { sequelize } = require('./models');
const fs = require('fs');
const path = require('path');

async function resetPostgresSchema() {
  try {
    console.log('🔧 PostgreSQL 스키마 초기화 시작...');
    
    // 1. 모든 테이블 삭제 (외래키 제약 조건 무시)
    console.log('🗑️ 기존 테이블 삭제 중...');
    
    const tables = [
      'SportActiveOverlayImages',
      'SportOverlayImages', 
      'TeamInfo',
      'Matches',
      'MatchLists',
      'Settings',
      'templates',
      'Sports',
      'users',
      'user_sessions'
    ];
    
    for (const table of tables) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
        console.log(`✅ 테이블 삭제: ${table}`);
      } catch (error) {
        console.warn(`⚠️ 테이블 삭제 실패: ${table} - ${error.message}`);
      }
    }
    
    // 2. 시퀀스 삭제
    console.log('🗑️ 시퀀스 삭제 중...');
    const sequences = [
      'users_id_seq',
      'sports_id_seq', 
      'matches_id_seq',
      'matchlists_id_seq',
      'teaminfo_id_seq',
      'settings_id_seq',
      'templates_id_seq',
      'sportoverlayimages_id_seq',
      'sportactiveoverlayimages_id_seq'
    ];
    
    for (const sequence of sequences) {
      try {
        await sequelize.query(`DROP SEQUENCE IF EXISTS "${sequence}" CASCADE;`);
        console.log(`✅ 시퀀스 삭제: ${sequence}`);
      } catch (error) {
        console.warn(`⚠️ 시퀀스 삭제 실패: ${sequence} - ${error.message}`);
      }
    }
    
    // 3. 테이블 재생성
    console.log('🔨 테이블 재생성 중...');
    await sequelize.sync({ force: true });
    console.log('✅ 테이블 재생성 완료');
    
    // 4. 기본 데이터 삽입
    console.log('📝 기본 데이터 삽입 중...');
    
    const { User, Sport, Template } = require('./models');
    
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
  resetPostgresSchema().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = resetPostgresSchema;
