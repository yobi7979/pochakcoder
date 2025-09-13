const fs = require('fs');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './sports.db',
  logging: false
});

async function exportData() {
  try {
    console.log('SQLite 데이터 내보내기 시작...');
    
    const [users] = await sequelize.query('SELECT * FROM users');
    const [sports] = await sequelize.query('SELECT * FROM Sports');
    const [templates] = await sequelize.query('SELECT * FROM templates');
    const [matches] = await sequelize.query('SELECT * FROM Matches');
    const [matchLists] = await sequelize.query('SELECT * FROM MatchLists');
    
    const exportData = {
      users,
      sports,
      templates,
      matches,
      matchLists,
      exportedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('sqlite-export.json', JSON.stringify(exportData, null, 2));
    
    console.log('데이터 내보내기 완료: sqlite-export.json');
    console.log(`- 사용자: ${users.length}개`);
    console.log(`- 종목: ${sports.length}개`);
    console.log(`- 템플릿: ${templates.length}개`);
    console.log(`- 경기: ${matches.length}개`);
    console.log(`- 리스트: ${matchLists.length}개`);
    
  } catch (error) {
    console.error('내보내기 실패:', error);
  } finally {
    await sequelize.close();
  }
}

exportData();
