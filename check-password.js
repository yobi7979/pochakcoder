const { sequelize, User } = require('./models');

async function checkPassword() {
  try {
    console.log('데이터베이스 연결 중...');
    await sequelize.authenticate();
    console.log('데이터베이스 연결 성공');

    // admin 사용자 정보 조회
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    
    if (adminUser) {
      console.log('=== Admin 사용자 정보 ===');
      console.log('ID:', adminUser.id);
      console.log('사용자명:', adminUser.username);
      console.log('저장된 비밀번호:', adminUser.password);
      console.log('비밀번호 길이:', adminUser.password ? adminUser.password.length : 0);
      console.log('역할:', adminUser.role);
      console.log('활성 상태:', adminUser.is_active);
      console.log('생성일:', adminUser.created_at);
      console.log('수정일:', adminUser.updated_at);
      
      // 비밀번호 비교 테스트
      const testPassword = 'admin123';
      console.log('\n=== 비밀번호 비교 테스트 ===');
      console.log('입력 비밀번호:', testPassword);
      console.log('저장된 비밀번호:', adminUser.password);
      console.log('비밀번호 일치:', adminUser.password === testPassword);
      
      // 해시된 비밀번호인지 확인
      if (adminUser.password && adminUser.password.length > 20) {
        console.log('비밀번호가 해시된 형태로 보입니다.');
      } else {
        console.log('비밀번호가 평문으로 저장되어 있습니다.');
      }
      
    } else {
      console.log('admin 사용자를 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

checkPassword();
