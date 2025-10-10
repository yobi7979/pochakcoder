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

    // 2. 기존 스키마 완전 삭제 (의존성 순서 고려)
    console.log('🗑️ 기존 스키마 삭제 중...');
    try {
      // 먼저 모든 테이블 삭제
      console.log('📋 테이블 삭제 중...');
      const tablesResult = await client.query(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);
      
      for (const table of tablesResult.rows) {
        try {
          await client.query(`DROP TABLE IF EXISTS public."${table.tablename}" CASCADE`);
          console.log(`  ✅ 테이블 삭제: ${table.tablename}`);
        } catch (error) {
          console.log(`  ⚠️ 테이블 삭제 실패: ${table.tablename} - ${error.message}`);
        }
      }
      
      // 모든 시퀀스 삭제
      console.log('🔢 시퀀스 삭제 중...');
      const sequencesResult = await client.query(`
        SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
      `);
      
      for (const sequence of sequencesResult.rows) {
        try {
          await client.query(`DROP SEQUENCE IF EXISTS public."${sequence.sequencename}" CASCADE`);
          console.log(`  ✅ 시퀀스 삭제: ${sequence.sequencename}`);
        } catch (error) {
          console.log(`  ⚠️ 시퀀스 삭제 실패: ${sequence.sequencename} - ${error.message}`);
        }
      }
      
      // 모든 뷰 삭제
      console.log('👁️ 뷰 삭제 중...');
      const viewsResult = await client.query(`
        SELECT viewname FROM pg_views WHERE schemaname = 'public'
      `);
      
      for (const view of viewsResult.rows) {
        try {
          await client.query(`DROP VIEW IF EXISTS public."${view.viewname}" CASCADE`);
          console.log(`  ✅ 뷰 삭제: ${view.viewname}`);
        } catch (error) {
          console.log(`  ⚠️ 뷰 삭제 실패: ${view.viewname} - ${error.message}`);
        }
      }
      
      // 모든 함수 삭제
      console.log('🔧 함수 삭제 중...');
      const functionsResult = await client.query(`
        SELECT proname, oidvectortypes(proargtypes) as argtypes 
        FROM pg_proc 
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `);
      
      for (const func of functionsResult.rows) {
        try {
          await client.query(`DROP FUNCTION IF EXISTS public."${func.proname}"(${func.argtypes}) CASCADE`);
          console.log(`  ✅ 함수 삭제: ${func.proname}`);
        } catch (error) {
          console.log(`  ⚠️ 함수 삭제 실패: ${func.proname} - ${error.message}`);
        }
      }
      
      // 모든 도메인 삭제
      console.log('🏷️ 도메인 삭제 중...');
      const domainsResult = await client.query(`
        SELECT typname FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
        AND typtype = 'd'
      `);
      
      for (const domain of domainsResult.rows) {
        try {
          await client.query(`DROP DOMAIN IF EXISTS public."${domain.typname}" CASCADE`);
          console.log(`  ✅ 도메인 삭제: ${domain.typname}`);
        } catch (error) {
          console.log(`  ⚠️ 도메인 삭제 실패: ${domain.typname} - ${error.message}`);
        }
      }
      
      // 모든 enum 타입 삭제 (마지막에)
      console.log('📝 enum 타입 삭제 중...');
      const enumsResult = await client.query(`
        SELECT typname FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
        AND typtype = 'e'
      `);
      
      for (const enumType of enumsResult.rows) {
        try {
          await client.query(`DROP TYPE IF EXISTS public."${enumType.typname}" CASCADE`);
          console.log(`  ✅ enum 타입 삭제: ${enumType.typname}`);
        } catch (error) {
          console.log(`  ⚠️ enum 타입 삭제 실패: ${enumType.typname} - ${error.message}`);
        }
      }
      
      // 마지막으로 스키마 삭제
      console.log('🗑️ 스키마 삭제 중...');
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
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
    let bcrypt;
    try {
      bcrypt = require('bcrypt');
      console.log('✅ bcrypt 모듈 로드 성공');
    } catch (error) {
      console.error('❌ bcrypt 모듈 로드 실패:', error.message);
      console.log('⚠️ bcrypt 없이 계속 진행...');
      bcrypt = null;
    }
    
    const { User } = require('./models');
    
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    if (!existingAdmin) {
      console.log('👤 관리자 계정 생성 중...');
      let hash;
      if (bcrypt) {
        try {
          hash = await bcrypt.hash('admin123', 10);
          console.log('✅ bcrypt 해시 생성 성공');
        } catch (error) {
          console.error('❌ bcrypt 해시 생성 실패:', error.message);
          console.log('⚠️ 평문 비밀번호로 계속 진행...');
          hash = 'admin123'; // 임시로 평문 사용
        }
      } else {
        console.log('⚠️ bcrypt 없음 - 평문 비밀번호 사용');
        hash = 'admin123'; // 임시로 평문 사용
      }
      
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
