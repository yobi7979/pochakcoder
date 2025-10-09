const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeRailwayDatabase() {
  console.log('🚀 Railway PostgreSQL 데이터베이스 초기화 시작...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. 데이터베이스 연결
    console.log('🔗 PostgreSQL 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 2. 기존 스키마 완전 삭제
    console.log('🗑️ 기존 스키마 삭제 중...');
    try {
      await client.query('DROP SCHEMA public CASCADE');
      console.log('✅ 기존 스키마 삭제 완료');
    } catch (error) {
      console.log('ℹ️ 기존 스키마가 없거나 이미 삭제됨');
    }

    // 3. 새로운 스키마 생성
    console.log('🔄 새로운 스키마 생성 중...');
    await client.query('CREATE SCHEMA public');
    console.log('✅ 새로운 스키마 생성 완료');

    // 4. 권한 설정
    console.log('🔐 권한 설정 중...');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ 권한 설정 완료');

    // 5. Sequelize 모델 동기화 (테이블 생성)
    console.log('📊 Sequelize 모델 동기화 중...');
    const { sequelize } = require('./models');
    
    // 강제 동기화 (기존 테이블 무시하고 새로 생성)
    await sequelize.sync({ force: true });
    console.log('✅ Sequelize 모델 동기화 완료');

    // 6. 기본 데이터 생성
    console.log('🌱 기본 데이터 생성 중...');
    
    // 관리자 계정 생성
    const bcrypt = require('bcrypt');
    const { User } = require('./models');
    
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    if (!existingAdmin) {
      console.log('👤 관리자 계정 생성 중...');
      const hash = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        password: hash,
        email: 'admin@sportscoder.com',
        full_name: 'Administrator',
        role: 'admin',
        is_active: true
      });
      console.log('✅ 관리자 계정 생성 완료 (admin/admin123)');
    } else {
      console.log('✅ 관리자 계정 이미 존재');
    }

    // 기본 종목 생성
    const { Sport } = require('./models');
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
      const existingSport = await Sport.findOne({ where: { code: sportData.code } });
      if (!existingSport) {
        console.log(`🏆 기본 종목 생성 중: ${sportData.name} (${sportData.code})`);
        await Sport.create(sportData);
        console.log(`✅ 기본 종목 생성 완료: ${sportData.name}`);
      } else {
        console.log(`✅ 기본 종목 이미 존재: ${sportData.name}`);
      }
    }

    // 7. 기본 템플릿 생성
    console.log('📄 기본 템플릿 생성 중...');
    const { Template } = require('./models');
    
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
      const existingTemplate = await Template.findOne({ where: { name: templateData.name } });
      if (!existingTemplate) {
        console.log(`📄 기본 템플릿 생성 중: ${templateData.name}`);
        await Template.create(templateData);
        console.log(`✅ 기본 템플릿 생성 완료: ${templateData.name}`);
      } else {
        console.log(`✅ 기본 템플릿 이미 존재: ${templateData.name}`);
      }
    }

    // 8. 기본 설정 생성
    console.log('⚙️ 기본 설정 생성 중...');
    const { Settings } = require('./models');
    
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
      const existingSetting = await Settings.findOne({ where: { key: settingData.key } });
      if (!existingSetting) {
        console.log(`⚙️ 기본 설정 생성 중: ${settingData.key}`);
        await Settings.create(settingData);
        console.log(`✅ 기본 설정 생성 완료: ${settingData.key}`);
      } else {
        console.log(`✅ 기본 설정 이미 존재: ${settingData.key}`);
      }
    }

    console.log('🎉 Railway PostgreSQL 데이터베이스 초기화 완료!');
    console.log('📊 생성된 데이터:');
    console.log('  - 관리자 계정: admin/admin123');
    console.log('  - 기본 종목: Soccer, Baseball');
    console.log('  - 기본 템플릿: soccer, baseball');
    console.log('  - 기본 설정: 홈팀/원정팀 컬러');

  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 데이터베이스 연결 종료');
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
