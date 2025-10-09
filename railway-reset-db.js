#!/usr/bin/env node

/**
 * Railway PostgreSQL 데이터베이스 초기화 스크립트
 * 리팩토링 이후 스키마로 PostgreSQL 데이터베이스를 완전히 재생성합니다.
 */

const { sequelize } = require('./models');
const { User, Sport, Template } = require('./models');

async function railwayResetDatabase() {
  try {
    console.log('🚀 Railway PostgreSQL 데이터베이스 초기화 시작...');
    
    // PostgreSQL 환경 확인
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`📊 데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    if (!isPostgres) {
      console.log('⚠️ PostgreSQL 환경이 아닙니다. Railway에서 실행해주세요.');
      return;
    }
    
    console.log('🗑️ 기존 테이블 및 데이터 삭제 중...');
    
    // PostgreSQL 전용 CASCADE 삭제
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
        const tableName = query.match(/"([^"]+)"/)?.[1] || 'unknown';
        console.log(`✅ 테이블 삭제: ${tableName}`);
      } catch (error) {
        console.warn(`⚠️ 테이블 삭제 실패: ${error.message}`);
      }
    }
    
    console.log('🔨 리팩토링 이후 스키마로 테이블 재생성 중...');
    await sequelize.sync({ force: true });
    console.log('✅ 테이블 재생성 완료');
    
    console.log('📝 기본 데이터 삽입 중...');
    
    // 1. 관리자 사용자 생성
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123',
      email: 'admin@sportscoder.com',
      full_name: '관리자',
      role: 'admin',
      is_active: true
    });
    console.log('✅ 관리자 사용자 생성 완료 (admin/admin123)');
    
    // 2. 기본 스포츠 생성
    const sports = [
      {
        name: '축구',
        code: 'SOCCER',
        template: 'soccer',
        description: '축구 경기',
        is_active: true,
        is_default: true
      },
      {
        name: '야구',
        code: 'BASEBALL',
        template: 'baseball',
        description: '야구 경기',
        is_active: true,
        is_default: true
      }
    ];
    
    for (const sportData of sports) {
      await Sport.create(sportData);
    }
    console.log('✅ 기본 스포츠 생성 완료 (축구, 야구)');
    
    // 3. 기본 템플릿 생성
    const templates = [
      {
        name: 'soccer',
        sport_type: 'SOCCER',
        template_type: 'overlay',
        content: '축구 오버레이 템플릿',
        file_name: 'soccer-template.ejs',
        is_default: true,
        created_by: adminUser.id
      },
      {
        name: 'baseball',
        sport_type: 'BASEBALL',
        template_type: 'overlay',
        content: '야구 오버레이 템플릿',
        file_name: 'baseball-template.ejs',
        is_default: true,
        created_by: adminUser.id
      }
    ];
    
    for (const templateData of templates) {
      await Template.create(templateData);
    }
    console.log('✅ 기본 템플릿 생성 완료 (soccer, baseball)');
    
    console.log('🎉 Railway PostgreSQL 데이터베이스 초기화 완료!');
    console.log('📊 생성된 데이터:');
    console.log('  - 사용자: 1명 (admin/admin123)');
    console.log('  - 스포츠: 2개 (축구, 야구)');
    console.log('  - 템플릿: 2개 (soccer, baseball)');
    console.log('  - 모든 테이블: 리팩토링 이후 스키마로 재생성');
    
    console.log('✅ Railway 배포 후 정상 작동할 준비가 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ Railway PostgreSQL 초기화 실패:', error);
    console.error('❌ 오류 상세:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// 스크립트 실행
if (require.main === module) {
  railwayResetDatabase().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = railwayResetDatabase;
