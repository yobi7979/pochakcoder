const { sequelize, User } = require('./models');

async function createAdminUser() {
  try {
    console.log('관리자 사용자 생성 중...');
    
    // 기존 사용자 삭제
    await User.destroy({ where: {} });
    console.log('기존 사용자 데이터 삭제 완료');
    
    // 관리자 사용자 생성
    await User.create({
      username: 'admin',
      password: 'admin',
      role: 'admin'
    });
    
    console.log('관리자 사용자 생성 완료');
    console.log('사용자명: admin');
    console.log('비밀번호: admin');
    
    await sequelize.close();
    console.log('데이터베이스 연결 종료');
    
  } catch (error) {
    console.error('사용자 생성 중 오류 발생:', error);
  }
}

// 스크립트 실행
createAdminUser()
  .then(() => {
    console.log('사용자 생성 스크립트 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('사용자 생성 스크립트 실행 중 오류 발생:', error);
    process.exit(1);
  });