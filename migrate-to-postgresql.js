const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// SQLite에서 데이터 읽기
const sqliteDb = new Sequelize({
  dialect: 'sqlite',
  storage: './sports.db',
  logging: false
});

// PostgreSQL 연결 (Railway 환경 변수 사용)
const postgresDb = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function migrateData() {
  try {
    console.log('데이터 마이그레이션 시작...');
    
    // SQLite에서 데이터 읽기
    const [users] = await sqliteDb.query('SELECT * FROM users');
    const [sports] = await sqliteDb.query('SELECT * FROM Sports');
    const [templates] = await sqliteDb.query('SELECT * FROM templates');
    const [matches] = await sqliteDb.query('SELECT * FROM Matches');
    const [matchLists] = await sqliteDb.query('SELECT * FROM MatchLists');
    
    console.log(`읽어온 데이터:`);
    console.log(`- 사용자: ${users.length}개`);
    console.log(`- 종목: ${sports.length}개`);
    console.log(`- 템플릿: ${templates.length}개`);
    console.log(`- 경기: ${matches.length}개`);
    console.log(`- 리스트: ${matchLists.length}개`);
    
    // PostgreSQL에 데이터 삽입
    if (users.length > 0) {
      await postgresDb.query('INSERT INTO users (id, username, password, email, full_name, role, is_active, created_at, updated_at) VALUES ' + 
        users.map(u => `(${u.id}, '${u.username}', '${u.password}', '${u.email || ''}', '${u.full_name || ''}', '${u.role}', ${u.is_active}, '${u.created_at}', '${u.updated_at}')`).join(', ') +
        ' ON CONFLICT (id) DO NOTHING');
    }
    
    if (sports.length > 0) {
      await postgresDb.query('INSERT INTO "Sports" (id, name, code, template, description, is_active, is_default, created_by, created_at, updated_at) VALUES ' + 
        sports.map(s => `(${s.id}, '${s.name}', '${s.code}', '${s.template}', '${s.description || ''}', ${s.is_active}, ${s.is_default}, ${s.created_by || 'NULL'}, '${s.created_at}', '${s.updated_at}')`).join(', ') +
        ' ON CONFLICT (id) DO NOTHING');
    }
    
    if (templates.length > 0) {
      await postgresDb.query('INSERT INTO templates (id, name, sport_type, template_type, content, file_name, is_default, created_by, created_at, updated_at) VALUES ' + 
        templates.map(t => `(${t.id}, '${t.name}', '${t.sport_type}', '${t.template_type}', '${t.content.replace(/'/g, "''")}', '${t.file_name || ''}', ${t.is_default}, ${t.created_by || 'NULL'}, '${t.created_at}', '${t.updated_at}')`).join(', ') +
        ' ON CONFLICT (id) DO NOTHING');
    }
    
    if (matches.length > 0) {
      await postgresDb.query('INSERT INTO "Matches" (id, sport_type, home_team, away_team, home_team_color, away_team_color, home_team_header, away_team_header, home_score, away_score, status, match_data, created_by, created_at, updated_at) VALUES ' + 
        matches.map(m => `('${m.id}', '${m.sport_type}', '${m.home_team}', '${m.away_team}', '${m.home_team_color}', '${m.away_team_color}', '${m.home_team_header}', '${m.away_team_header}', ${m.home_score}, ${m.away_score}, '${m.status}', '${JSON.stringify(m.match_data).replace(/'/g, "''")}', ${m.created_by || 'NULL'}, '${m.created_at}', '${m.updated_at}')`).join(', ') +
        ' ON CONFLICT (id) DO NOTHING');
    }
    
    if (matchLists.length > 0) {
      await postgresDb.query('INSERT INTO "MatchLists" (id, name, matches, custom_url, created_by, created_at, updated_at) VALUES ' + 
        matchLists.map(ml => `(${ml.id}, '${ml.name}', '${JSON.stringify(ml.matches).replace(/'/g, "''")}', '${ml.custom_url || ''}', ${ml.created_by || 'NULL'}, '${ml.created_at}', '${ml.updated_at}')`).join(', ') +
        ' ON CONFLICT (id) DO NOTHING');
    }
    
    console.log('데이터 마이그레이션 완료!');
    
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  } finally {
    await sqliteDb.close();
    await postgresDb.close();
  }
}

migrateData();
