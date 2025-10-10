const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway 환경에서 Sequelize 모델 사용
process.env.NODE_ENV = 'railway-init';
process.env.RAILWAY_DB_INIT = 'true';

console.log('🔧 Railway 환경에서 Sequelize 모델 사용');

async function initializeRailwayDatabase() {
  console.log('🚀 Railway PostgreSQL 데이터베이스 초기화 시작...');
  
  try {
    // Sequelize 모델 로딩
    console.log('🔧 Sequelize 모델 로딩 중...');
    const { sequelize, User, Sport, Template, Settings, Match, SportOverlayImage, SportActiveOverlayImage, MatchList, UserSportPermission, TeamInfo } = require('./models');
    console.log('✅ Sequelize 모델 로딩 성공');
    
    // 데이터베이스 연결
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    try {
      await sequelize.authenticate();
      console.log('✅ 데이터베이스 연결 성공');
    } catch (error) {
      console.error('❌ 데이터베이스 연결 실패:', error.message);
      console.log('🔄 연결 재시도 중...');
      
      // 잠시 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await sequelize.authenticate();
        console.log('✅ 데이터베이스 재연결 성공');
      } catch (retryError) {
        console.error('❌ 데이터베이스 재연결 실패:', retryError.message);
        throw retryError;
      }
    }

    // Sequelize를 사용하여 DB 초기화 (필요한 테이블만)
    console.log('🗑️ Sequelize를 사용하여 DB 초기화 중...');
    try {
      // Sequelize sync로 테이블 생성/업데이트 (force: true로 기존 테이블 삭제 후 재생성)
      console.log('📋 Sequelize sync 실행 중...');
      await sequelize.sync({ force: true });
      console.log('✅ Sequelize sync 완료 - 필요한 테이블만 생성됨');
    } catch (error) {
      console.log('ℹ️ Sequelize sync 중 오류:', error.message);
    }

    // 6. 기본 데이터 생성
    console.log('🌱 기본 데이터 생성 중...');

    // 관리자 계정 생성 (Railway 환경에서는 평문 비밀번호 사용)
    console.log('🔐 관리자 계정 생성 중...');
    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    
    // Railway 환경에서는 bcrypt 없이 평문 비밀번호 사용
    console.log('⚠️ Railway 환경 - 평문 비밀번호 사용 (보안상 개발용)');
    const hashedPassword = adminPassword;

    try {
      const existingAdmin = await User.findOne({ where: { username: adminUsername } });
      if (!existingAdmin) {
        console.log('👤 관리자 계정 생성 중...');
        await User.create({
          username: adminUsername,
          password: hashedPassword,
          email: 'admin@sportscoder.com',
          full_name: 'Administrator',
          role: 'admin',
          is_active: true
        });
        console.log('✅ 관리자 계정 생성 완료 (admin/admin123)');
      } else {
        console.log('✅ 관리자 계정 이미 존재');
      }
    } catch (error) {
      console.error('❌ 관리자 계정 생성 실패:', error.message);
    }

    // 기본 종목 생성
    const defaultSports = [
      {
        name: 'Soccer',
        code: 'SOCCER',
        template: 'soccer',
        description: 'Football/Soccer sport',
        is_active: true,
        is_default: true
      },
      {
        name: 'Baseball',
        code: 'BASEBALL',
        template: 'baseball',
        description: 'Baseball sport',
        is_active: true,
        is_default: true
      }
    ];

    for (const sportData of defaultSports) {
      try {
        const existingSport = await Sport.findOne({ where: { code: sportData.code } });
        if (!existingSport) {
          console.log(`🏆 기본 종목 생성 중: ${sportData.name} (${sportData.code})`);
          await Sport.create(sportData);
          console.log(`✅ 기본 종목 생성 완료: ${sportData.name}`);
        } else {
          console.log(`✅ 기본 종목 이미 존재: ${sportData.name}`);
        }
      } catch (error) {
        console.error(`❌ 종목 ${sportData.name} 생성 실패:`, error.message);
      }
    }

    // 기본 템플릿 생성
    console.log('📄 기본 템플릿 생성 중...');
    const defaultTemplates = [
      {
        name: 'soccer',
        sport_type: 'SOCCER',
        template_type: 'overlay',
        content: 'Default soccer template',
        file_name: 'soccer-template.ejs',
        is_default: true
      },
      {
        name: 'baseball',
        sport_type: 'BASEBALL',
        template_type: 'overlay',
        content: 'Default baseball template',
        file_name: 'baseball-template.ejs',
        is_default: true
      }
    ];

    for (const templateData of defaultTemplates) {
      try {
        const existingTemplate = await Template.findOne({ where: { name: templateData.name } });
        if (!existingTemplate) {
          console.log(`📄 기본 템플릿 생성 중: ${templateData.name}`);
          await Template.create(templateData);
          console.log(`✅ 기본 템플릿 생성 완료: ${templateData.name}`);
        } else {
          console.log(`✅ 기본 템플릿 이미 존재: ${templateData.name}`);
        }
      } catch (error) {
        console.error(`❌ 템플릿 ${templateData.name} 생성 실패:`, error.message);
      }
    }

    // 기본 설정 생성
    console.log('⚙️ 기본 설정 생성 중...');
    const defaultSettings = [
      {
        key: 'default_home_color',
        value: '#FF0000',
        description: '홈팀 기본 컬러'
      },
      {
        key: 'default_away_color',
        value: '#0000FF',
        description: '원정팀 기본 컬러'
      }
    ];

    for (const settingData of defaultSettings) {
      try {
        const existingSetting = await Settings.findOne({ where: { key: settingData.key } });
        if (!existingSetting) {
          console.log(`⚙️ 기본 설정 생성 중: ${settingData.key}`);
          await Settings.create(settingData);
          console.log(`✅ 기본 설정 생성 완료: ${settingData.key}`);
        } else {
          console.log(`✅ 기본 설정 이미 존재: ${settingData.key}`);
        }
      } catch (error) {
        console.error(`❌ 설정 ${settingData.key} 생성 실패:`, error.message);
      }
    }

    console.log('🎉 Railway PostgreSQL 데이터베이스 초기화 완료!');
    console.log('📊 생성된 데이터:');
    console.log('  - 관리자 계정: admin/admin123');
    console.log('  - 기본 종목: Soccer, Baseball');
    console.log('  - 기본 템플릿: soccer, baseball');
    console.log('  - 기본 설정: 홈팀/원정팀 컬러');
    console.log('📋 생성된 테이블:');
    console.log('  - users (사용자)');
    console.log('  - Sports (종목)');
    console.log('  - templates (템플릿)');
    console.log('  - Settings (설정)');
    console.log('  - Matches (경기)');
    console.log('  - SportOverlayImages (오버레이 이미지)');
    console.log('  - SportActiveOverlayImages (활성 오버레이)');
    console.log('  - MatchLists (경기 목록)');
    console.log('  - UserSportPermissions (사용자 권한)');
    console.log('  - TeamInfo (팀 정보)');

  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  } finally {
    try {
      const { sequelize } = require('./models');
      await sequelize.close();
      console.log('🔌 데이터베이스 연결 종료');
    } catch (error) {
      console.log('🔌 데이터베이스 연결 종료 중 오류:', error.message);
    }
  }
}

// Railway 환경에서만 실행
if (process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL) {
  console.log('🚀 Railway 환경 감지 - 데이터베이스 초기화 시작');
  initializeRailwayDatabase()
    .then(() => {
      console.log('✅ Railway 데이터베이스 초기화 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Railway 데이터베이스 초기화 실패:', error);
      process.exit(1);
    });
} else {
  console.log('ℹ️ 로컬 환경 - 데이터베이스 초기화 건너뜀');
}

module.exports = { initializeRailwayDatabase };