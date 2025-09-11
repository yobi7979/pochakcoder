const { sequelize, User } = require('./models');

async function createAdminUser() {
  try {
    // 데이터베이스 연결 확인
    await sequelize.authenticate();
    console.log('데이터베이스 연결 성공');

    // 기존 관리자 사용자 확인
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    
    if (existingAdmin) {
      console.log('관리자 사용자가 이미 존재합니다:', existingAdmin.username);
      return;
    }

    // 새 관리자 사용자 생성
    const adminUser = await User.create({
      username: 'admin',
      password: 'sports2024',
      full_name: '시스템 관리자',
      email: 'admin@sportscoder.com',
      role: 'admin',
      is_active: true
    });

    console.log('관리자 사용자가 성공적으로 생성되었습니다:');
    console.log('- 사용자명:', adminUser.username);
    console.log('- 비밀번호: sports2024');
    console.log('- 권한:', adminUser.role);
    console.log('- 이메일:', adminUser.email);

  } catch (error) {
    console.error('관리자 사용자 생성 중 오류:', error);
  } finally {
    await sequelize.close();
  }
}

// 스크립트 실행
createAdminUser();
