const express = require('express');
const router = express.Router();
const { sequelize, Match, TeamInfo, Settings } = require('../models');

// GET /db-management - DB 관리 페이지 렌더링
router.get('/', (req, res) => {
  res.render('db-management');
});

// GET /api/sport-management - 종목 관리 페이지 데이터 조회
router.get('/api', async (req, res) => {
  try {
    console.log('종목 관리 페이지 데이터 조회 요청');
    
    // 환경 감지
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    console.log(`데이터베이스 환경: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    // 1. 모든 종목별 통계 조회 (환경별 쿼리)
    let sportStats;
    if (isPostgres) {
      // PostgreSQL 쿼리
      const [results] = await sequelize.query(`
        SELECT 
          m.sport_type,
          COUNT(DISTINCT m.id) as match_count,
          COUNT(t.id) as team_info_count,
          COUNT(t.logo_path) as logo_count,
          STRING_AGG(DISTINCT t.team_color, ',') as used_colors,
          MIN(m.created_at) as first_created,
          MAX(m.updated_at) as last_updated
        FROM matches m
        LEFT JOIN teaminfo t ON m.id = t.match_id
        GROUP BY m.sport_type
        ORDER BY m.sport_type
      `);
      sportStats = results;
    } else {
      // SQLite 쿼리
      const [results] = await sequelize.query(`
        SELECT 
          m.sport_type,
          COUNT(DISTINCT m.id) as match_count,
          COUNT(t.id) as team_info_count,
          COUNT(t.logo_path) as logo_count,
          GROUP_CONCAT(DISTINCT t.team_color) as used_colors,
          MIN(m.created_at) as first_created,
          MAX(m.updated_at) as last_updated
        FROM Matches m
        LEFT JOIN TeamInfo t ON m.id = t.match_id
        GROUP BY m.sport_type
        ORDER BY m.sport_type
      `);
      sportStats = results;
    }
    
    console.log('조회된 종목 통계:', sportStats);
    
    // 2. 종목별 상세 정보 조회
    const detailedStats = [];
    for (const stat of sportStats) {
      console.log(`종목 ${stat.sport_type}의 팀 상세 정보 조회 중...`);
      
      let teamDetails;
      if (isPostgres) {
        // PostgreSQL 쿼리
        const [results] = await sequelize.query(`
          SELECT 
            id,
            match_id,
            team_name,
            team_type,
            team_color,
            team_header,
            logo_path,
            logo_bg_color,
            created_at,
            updated_at
          FROM teaminfo 
          WHERE sport_type = $1
          ORDER BY match_id, team_type
        `, { 
          replacements: [stat.sport_type], 
          type: sequelize.QueryTypes.SELECT 
        });
        teamDetails = results;
      } else {
        // SQLite 쿼리
        const [results] = await sequelize.query(`
          SELECT 
            id,
            match_id,
            team_name,
            team_type,
            team_color,
            team_header,
            logo_path,
            logo_bg_color,
            created_at,
            updated_at
          FROM TeamInfo 
          WHERE sport_type = ?
          ORDER BY match_id, team_type
        `, { 
          replacements: [stat.sport_type], 
          type: sequelize.QueryTypes.SELECT 
        });
        teamDetails = results;
      }
      
      console.log(`종목 ${stat.sport_type}의 팀 상세 정보:`, teamDetails);
      
      // teamDetails가 배열이 아닌 경우 배열로 변환
      const teamDetailsArray = Array.isArray(teamDetails) ? teamDetails : [teamDetails];
      
      detailedStats.push({
        sport_type: stat.sport_type,
        match_count: stat.match_count,
        team_info_count: stat.team_info_count,
        logo_count: stat.logo_count,
        used_colors: stat.used_colors ? stat.used_colors.split(',') : [],
        first_created: stat.first_created,
        last_updated: stat.last_updated,
        team_details: teamDetailsArray
      });
    }
    
    // 3. Settings 테이블 데이터 조회
    console.log('Settings 테이블 데이터 조회 중...');
    let settingsData;
    if (isPostgres) {
      // PostgreSQL 쿼리
      const [results] = await sequelize.query(`
        SELECT 
          id,
          key,
          value,
          description,
          created_at,
          updated_at
        FROM settings 
        ORDER BY created_at DESC
      `);
      settingsData = results;
    } else {
      // SQLite 쿼리
      const [results] = await sequelize.query(`
        SELECT 
          id,
          key,
          value,
          description,
          created_at,
          updated_at
        FROM Settings 
        ORDER BY created_at DESC
      `);
      settingsData = results;
    }
    
    console.log('Settings 테이블 데이터:', settingsData);
    
    res.json({
      success: true,
      sports: detailedStats,
      settings: settingsData,
      total_sports: detailedStats.length,
      total_matches: detailedStats.reduce((sum, sport) => sum + sport.match_count, 0),
      total_team_info: detailedStats.reduce((sum, sport) => sum + sport.team_info_count, 0),
      total_settings: settingsData.length
    });
    
  } catch (error) {
    console.error('종목 관리 페이지 데이터 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/sport-management/:sportType - 특정 종목 상세 정보 조회
router.get('/api/:sportType', async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`특정 종목 상세 정보 조회: ${sportType}`);
    
    // 환경 감지
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    
    // 특정 종목의 모든 경기 정보 조회
    let matches, teamInfo, stats;
    if (isPostgres) {
      // PostgreSQL 쿼리
      const [matchesResult] = await sequelize.query(`
        SELECT 
          m.id,
          m.home_team,
          m.away_team,
          m.home_score,
          m.away_score,
          m.status,
          m.created_at,
          m.updated_at
        FROM matches m
        WHERE m.sport_type = $1
        ORDER BY m.created_at DESC
      `, [sportType]);
      matches = matchesResult;
      
      const [teamInfoResult] = await sequelize.query(`
        SELECT 
          match_id,
          team_name,
          team_type,
          team_color,
          team_header,
          logo_path,
          logo_bg_color,
          created_at,
          updated_at
        FROM teaminfo 
        WHERE sport_type = $1
        ORDER BY match_id, team_type
      `, [sportType]);
      teamInfo = teamInfoResult;
      
      const [statsResult] = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT m.id) as match_count,
          COUNT(t.id) as team_info_count,
          COUNT(t.logo_path) as logo_count,
          STRING_AGG(DISTINCT t.team_color, ',') as used_colors
        FROM matches m
        LEFT JOIN teaminfo t ON m.id = t.match_id
        WHERE m.sport_type = $1
      `, [sportType]);
      stats = statsResult;
    } else {
      // SQLite 쿼리
      const [matchesResult] = await sequelize.query(`
        SELECT 
          m.id,
          m.home_team,
          m.away_team,
          m.home_score,
          m.away_score,
          m.status,
          m.created_at,
          m.updated_at
        FROM Matches m
        WHERE m.sport_type = ?
        ORDER BY m.created_at DESC
      `, [sportType]);
      matches = matchesResult;
      
      const [teamInfoResult] = await sequelize.query(`
        SELECT 
          match_id,
          team_name,
          team_type,
          team_color,
          team_header,
          logo_path,
          logo_bg_color,
          created_at,
          updated_at
        FROM TeamInfo 
        WHERE sport_type = ?
        ORDER BY match_id, team_type
      `, [sportType]);
      teamInfo = teamInfoResult;
      
      const [statsResult] = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT m.id) as match_count,
          COUNT(t.id) as team_info_count,
          COUNT(t.logo_path) as logo_count,
          GROUP_CONCAT(DISTINCT t.team_color) as used_colors
        FROM Matches m
        LEFT JOIN TeamInfo t ON m.id = t.match_id
        WHERE m.sport_type = ?
      `, [sportType]);
      stats = statsResult;
    }
    
    res.json({
      success: true,
      sport_type: sportType,
      stats: stats[0],
      matches: matches,
      team_info: teamInfo
    });
    
  } catch (error) {
    console.error('특정 종목 상세 정보 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// DELETE /api/sport-management/:sportType - 특정 종목 삭제
router.delete('/api/:sportType', async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`종목 삭제 요청: ${sportType}`);
    
    // 삭제 전 영향받을 데이터 확인
    const [impactData] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT m.id) as match_count,
        COUNT(t.id) as team_info_count,
        GROUP_CONCAT(DISTINCT m.id) as match_ids
      FROM Matches m
      LEFT JOIN TeamInfo t ON m.id = t.match_id
      WHERE m.sport_type = ?
    `, [sportType]);
    
    const impact = impactData[0];
    console.log(`삭제될 데이터: 경기 ${impact.match_count}개, 팀 정보 ${impact.team_info_count}개`);
    
    if (impact.match_count === 0) {
      return res.json({
        success: true,
        message: '삭제할 데이터가 없습니다.',
        deleted: {
          matches: 0,
          team_info: 0
        }
      });
    }
    
    // 트랜잭션으로 안전하게 삭제
    const transaction = await sequelize.transaction();
    
    try {
      // 1. TeamInfo 삭제 (외래키로 인해 먼저 삭제)
      const deletedTeamInfo = await sequelize.query(`
        DELETE FROM TeamInfo 
        WHERE match_id IN (
          SELECT id FROM Matches WHERE sport_type = ?
        )
      `, {
        replacements: [sportType],
        transaction
      });
      
      // 2. Matches 삭제
      const deletedMatches = await sequelize.query(`
        DELETE FROM Matches 
        WHERE sport_type = ?
      `, {
        replacements: [sportType],
        transaction
      });
      
      await transaction.commit();
      
      console.log(`종목 삭제 완료: ${sportType}`);
      console.log(`삭제된 경기: ${impact.match_count}개`);
      console.log(`삭제된 팀 정보: ${impact.team_info_count}개`);
      
      res.json({
        success: true,
        message: `종목 '${sportType}'이 성공적으로 삭제되었습니다.`,
        deleted: {
          matches: impact.match_count,
          team_info: impact.team_info_count,
          match_ids: impact.match_ids ? impact.match_ids.split(',') : []
        }
      });
      
    } catch (deleteError) {
      await transaction.rollback();
      throw deleteError;
    }
    
  } catch (error) {
    console.error('종목 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '종목 삭제 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// POST /api/sport-management/:sportType/backup - 특정 종목 백업
router.post('/api/:sportType/backup', async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`종목 백업 요청: ${sportType}`);
    
    // 백업 데이터 수집
    const [matches] = await sequelize.query(`
      SELECT * FROM Matches WHERE sport_type = ?
    `, [sportType]);
    
    const [teamInfo] = await sequelize.query(`
      SELECT * FROM TeamInfo WHERE sport_type = ?
    `, [sportType]);
    
    const backupData = {
      sport_type: sportType,
      backup_date: new Date().toISOString(),
      matches: matches,
      team_info: teamInfo,
      total_matches: matches.length,
      total_team_info: teamInfo.length
    };
    
    // 백업 파일 저장 (선택사항)
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, '../backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupFileName = `sport_${sportType}_backup_${Date.now()}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);
    
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    
    console.log(`종목 백업 완료: ${sportType}`);
    console.log(`백업 파일: ${backupFilePath}`);
    
    res.json({
      success: true,
      message: `종목 '${sportType}' 백업이 완료되었습니다.`,
      backup_file: backupFileName,
      backup_data: backupData
    });
    
  } catch (error) {
    console.error('종목 백업 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '종목 백업 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/team-logos/:sportType - 팀로고 목록 조회
router.get('/team-logos/:sportType', async (req, res) => {
  try {
    const { sportType } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    console.log(`팀로고 목록 조회 요청: ${sportType}`);
    
    const logoDir = path.join(__dirname, '..', 'public', 'TEAMLOGO', sportType.toUpperCase());
    const logos = [];
    
    try {
      if (fs.existsSync(logoDir)) {
        const files = fs.readdirSync(logoDir);
        files.forEach(file => {
          if (file.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg)$/)) {
            logos.push({
              name: file,
              path: `TEAMLOGO/${sportType.toUpperCase()}/${file}`
            });
          }
        });
      }
    } catch (error) {
      console.log(`로고 디렉토리 읽기 실패: ${logoDir}`);
    }
    
    console.log(`조회된 로고 개수: ${logos.length}`);
    console.log('로고 목록:', logos);
    res.json({ success: true, logos });
    
  } catch (error) {
    console.error('팀로고 목록 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '팀로고 목록 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// PUT /api/sport-management/team-info/:id - 팀 정보 수정
router.put('/team-info/:id', async (req, res) => {
  console.log('라우터 매칭 성공: PUT /team-info/:id');
  try {
    const { id } = req.params;
    const { team_name, team_color, team_header, logo_path, logo_bg_color } = req.body;
    
    console.log(`팀 정보 수정 요청: ID ${id}`);
    
    // 1. TeamInfo 테이블에서 팀 정보 조회 (match_id와 team_type 확인용)
    const teamInfo = await sequelize.query(`
      SELECT match_id, team_type, sport_type 
      FROM TeamInfo 
      WHERE id = ?
    `, {
      replacements: [id],
      type: sequelize.QueryTypes.SELECT
    });
    
    if (teamInfo.length === 0) {
      console.log(`팀 정보를 찾을 수 없음: ID ${id}`);
      return res.status(404).json({ success: false, message: '팀 정보를 찾을 수 없습니다.' });
    }
    
    const { match_id, team_type, sport_type } = teamInfo[0];
    
    // 2. TeamInfo 테이블 업데이트
    const result = await sequelize.query(`
      UPDATE TeamInfo 
      SET team_name = ?, team_color = ?, team_header = ?, logo_path = ?, logo_bg_color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, {
      replacements: [team_name, team_color, team_header, logo_path, logo_bg_color, id],
      type: sequelize.QueryTypes.UPDATE
    });
    
    const updatedRows = result[1]; // Sequelize UPDATE 결과에서 영향받은 행 수
    console.log(`업데이트된 행 수: ${updatedRows}`);
    
    if (updatedRows > 0) {
      console.log(`팀 정보 수정 완료: ID ${id}`);
      
      // 3. Matches 테이블도 업데이트 (실시간 동기화를 위해)
      const { Match } = require('../models');
      const match = await Match.findByPk(match_id);
      if (match) {
        if (team_type === 'home') {
          await match.update({
            home_team: team_name,
            home_team_color: team_color,
            home_team_header: team_header
          });
        } else if (team_type === 'away') {
          await match.update({
            away_team: team_name,
            away_team_color: team_color,
            away_team_header: team_header
          });
        }
        console.log(`Matches 테이블 업데이트 완료: matchId=${match_id}`);
      }
      
      // 4. WebSocket을 통한 실시간 업데이트 이벤트 전송
      const io = req.app.get('io'); // server_refactored_new.js에서 설정된 io 인스턴스
      if (io) {
        const roomName = `match_${match_id}`;
        
        // 팀 이름 업데이트 이벤트
        io.to(roomName).emit('teamNameUpdated', {
          matchId: match_id,
          team: team_type,
          teamName: team_name
        });
        
        // 팀 색상 업데이트 이벤트
        io.to(roomName).emit('teamColorUpdated', {
          matchId: match_id,
          teamType: team_type,
          teamColor: team_color,
          headerText: team_header
        });
        
        // 팀 로고 업데이트 이벤트
        io.to(roomName).emit('teamLogoUpdated', {
          matchId: match_id,
          teamType: team_type,
          logoPath: logo_path,
          logoBgColor: logo_bg_color
        });
        
        console.log(`WebSocket 실시간 업데이트 이벤트 전송: room=${roomName}`);
      }
      
      res.json({ success: true, message: '팀 정보가 수정되었습니다.' });
    } else {
      console.log(`팀 정보를 찾을 수 없음: ID ${id}`);
      res.status(404).json({ success: false, message: '팀 정보를 찾을 수 없습니다.' });
    }
    
  } catch (error) {
    console.error('팀 정보 수정 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '팀 정보 수정 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// DELETE /api/sport-management/team-info/:id - 팀 정보 삭제
router.delete('/team-info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`팀 정보 삭제 요청: ID ${id}`);
    
    const [deletedRows] = await sequelize.query(`
      DELETE FROM TeamInfo WHERE id = ?
    `, {
      replacements: [id],
      type: sequelize.QueryTypes.DELETE
    });
    
    if (deletedRows > 0) {
      console.log(`팀 정보 삭제 완료: ID ${id}`);
      res.json({ success: true, message: '팀 정보가 삭제되었습니다.' });
    } else {
      res.status(404).json({ success: false, message: '팀 정보를 찾을 수 없습니다.' });
    }
    
  } catch (error) {
    console.error('팀 정보 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '팀 정보 삭제 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/sport-management/check-match/:matchId - 경기 존재 여부 확인
router.get('/check-match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`경기 존재 여부 확인: ${matchId}`);
    
    const match = await Match.findOne({
      where: { id: matchId }
    });
    
    res.json({ exists: !!match });
  } catch (error) {
    console.error('경기 존재 여부 확인 오류:', error);
    res.status(500).json({ 
      error: '경기 존재 여부 확인 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// DELETE /api/sport-management/settings/:id - Settings 데이터 삭제
router.delete('/settings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Settings 데이터 삭제 요청: ID ${id}`);
    
    const setting = await Settings.findByPk(id);
    if (!setting) {
      return res.status(404).json({ error: '해당 Settings 데이터를 찾을 수 없습니다.' });
    }
    
    await Settings.destroy({
      where: { id: id }
    });
    
    console.log(`Settings 데이터 삭제 완료: ID ${id}, Key: ${setting.key}`);
    res.json({ success: true, message: 'Settings 데이터가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Settings 데이터 삭제 오류:', error);
    res.status(500).json({ 
      error: 'Settings 데이터 삭제 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

module.exports = router;
