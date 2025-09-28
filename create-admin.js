const { sequelize, User } = require('./models');

async function createAdminUser() {
  try {
    console.log('데이터베이스 연결 중...');
    await sequelize.authenticate();
    console.log('데이터베이스 연결 성공');

    // 기존 관리자 사용자 확인
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    
    if (existingAdmin) {
      console.log('관리자 사용자가 이미 존재합니다.');
      console.log('사용자명:', existingAdmin.username);
      console.log('비밀번호: admin123');
      console.log('역할:', existingAdmin.role);
      console.log('활성 상태:', existingAdmin.is_active);
    } else {
      // 관리자 사용자 생성
      const adminUser = await User.create({
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        is_active: true,
        full_name: '관리자',
        email: 'admin@sportscoder.com'
      });
      
      console.log('관리자 사용자 생성 완료!');
      console.log('사용자명: admin');
      console.log('비밀번호: admin123');
      console.log('ID:', adminUser.id);
    }

    // 모든 사용자 목록 출력
    const allUsers = await User.findAll();
    console.log('\n현재 등록된 사용자:');
    allUsers.forEach(user => {
      console.log(`- ${user.username} (${user.role}) - 활성: ${user.is_active}`);
    });

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

createAdminUser();
