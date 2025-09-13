const fs = require('fs');
const path = require('path');
const { sequelize, Match, User, Sport, Template, MatchList } = require('./models');

async function backupData() {
  try {
    console.log('데이터 백업 시작...');
    
    const backup = {
      matches: await Match.findAll({ raw: true }),
      users: await User.findAll({ raw: true }),
      sports: await Sport.findAll({ raw: true }),
      templates: await Template.findAll({ raw: true }),
      matchLists: await MatchList.findAll({ raw: true }),
      timestamp: new Date().toISOString()
    };
    
    const backupPath = path.join(__dirname, 'backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`백업 완료: ${backupPath}`);
    console.log(`- 경기: ${backup.matches.length}개`);
    console.log(`- 사용자: ${backup.users.length}개`);
    console.log(`- 종목: ${backup.sports.length}개`);
    console.log(`- 템플릿: ${backup.templates.length}개`);
    console.log(`- 리스트: ${backup.matchLists.length}개`);
    
  } catch (error) {
    console.error('백업 실패:', error);
  } finally {
    await sequelize.close();
  }
}

async function restoreData() {
  try {
    console.log('데이터 복원 시작...');
    
    const backupPath = path.join(__dirname, 'backup.json');
    if (!fs.existsSync(backupPath)) {
      console.log('백업 파일이 없습니다.');
      return;
    }
    
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // 데이터 복원
    if (backup.users.length > 0) {
      await User.bulkCreate(backup.users, { ignoreDuplicates: true });
      console.log(`사용자 복원: ${backup.users.length}개`);
    }
    
    if (backup.sports.length > 0) {
      await Sport.bulkCreate(backup.sports, { ignoreDuplicates: true });
      console.log(`종목 복원: ${backup.sports.length}개`);
    }
    
    if (backup.templates.length > 0) {
      await Template.bulkCreate(backup.templates, { ignoreDuplicates: true });
      console.log(`템플릿 복원: ${backup.templates.length}개`);
    }
    
    if (backup.matches.length > 0) {
      await Match.bulkCreate(backup.matches, { ignoreDuplicates: true });
      console.log(`경기 복원: ${backup.matches.length}개`);
    }
    
    if (backup.matchLists.length > 0) {
      await MatchList.bulkCreate(backup.matchLists, { ignoreDuplicates: true });
      console.log(`리스트 복원: ${backup.matchLists.length}개`);
    }
    
    console.log('데이터 복원 완료!');
    
  } catch (error) {
    console.error('복원 실패:', error);
  } finally {
    await sequelize.close();
  }
}

// 명령행 인수에 따라 백업 또는 복원 실행
const command = process.argv[2];
if (command === 'backup') {
  backupData();
} else if (command === 'restore') {
  restoreData();
} else {
  console.log('사용법: node backup-data.js [backup|restore]');
}
