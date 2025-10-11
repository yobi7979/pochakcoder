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
    
    // PostgreSQL에서 실제 테이블명 확인
    if (isPostgres) {
      try {
        const [tables] = await sequelize.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `);
        console.log('PostgreSQL에서 발견된 테이블들:', tables.map(t => t.table_name));
      } catch (error) {
        console.error('테이블 목록 조회 실패:', error);
      }
    }
    
    // 1. 모든 등록된 종목 조회 (Sports 테이블에서)
    const { Sport } = require('../models');
    const allSports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default', 'created_at', 'updated_at'],
      order: [['id', 'ASC']]
    });
    
    console.log('등록된 모든 종목:', allSports.map(s => ({ name: s.name, code: s.code, is_default: s.is_default })));
    
    // 2. 각 종목별 통계 조회 (Sequelize 모델 사용)
    let sportStats = [];
    for (const sport of allSports) {
      let stats;
      
      try {
        // Sequelize 모델을 직접 사용하여 통계 조회
        const { Match, TeamInfo } = require('../models');
        
        const matchCount = await Match.count({ where: { sport_type: sport.code } });
        const teamInfoCount = await TeamInfo.count({ where: { sport_type: sport.code } });
        
        // 팀 색상 정보 조회
        const teamColors = await TeamInfo.findAll({
          where: { sport_type: sport.code },
          attributes: ['team_color'],
          group: ['team_color']
        });
        
        // 경기 생성/수정 시간 조회
        const matchDates = await Match.findAll({
          where: { sport_type: sport.code },
          attributes: ['created_at', 'updated_at'],
          order: [['created_at', 'ASC']]
        });
        
        const firstCreated = matchDates.length > 0 ? matchDates[0].created_at : null;
        const lastUpdated = matchDates.length > 0 ? 
          matchDates.reduce((latest, match) => 
            new Date(match.updated_at) > new Date(latest) ? match.updated_at : latest, 
            matchDates[0].updated_at
          ) : null;
        
        stats = {
          sport_type: sport.code,
          match_count: matchCount,
          team_info_count: teamInfoCount,
          logo_count: await TeamInfo.count({ 
            where: { 
              sport_type: sport.code,
              logo_path: { [require('sequelize').Op.ne]: null }
            } 
          }),
          used_colors: teamColors.map(tc => tc.team_color).filter(c => c).join(','),
          first_created: firstCreated,
          last_updated: lastUpdated
        };
        
        console.log(`종목 ${sport.code} 통계:`, stats);
      } catch (error) {
        console.error(`종목 ${sport.code} 통계 조회 실패:`, error);
        stats = {
          sport_type: sport.code,
          match_count: 0,
          team_info_count: 0,
          logo_count: 0,
          used_colors: null,
          first_created: null,
          last_updated: null
        };
      }
      
      // 경기가 없는 종목의 경우 기본값 설정
      if (!stats.match_count) {
        stats = {
          sport_type: sport.code,
          match_count: 0,
          team_info_count: 0,
          logo_count: 0,
          used_colors: null,
          first_created: null,
          last_updated: null
        };
      }
      
      sportStats.push({
        ...stats,
        sport_name: sport.name,
        sport_template: sport.template,
        sport_description: sport.description,
        sport_is_active: sport.is_active,
        sport_is_default: sport.is_default,
        sport_created_at: sport.created_at,
        sport_updated_at: sport.updated_at
      });
    }
    
    console.log('조회된 종목 통계:', sportStats);
    
    // 2. 종목별 상세 정보 조회
    const detailedStats = [];
    for (const stat of sportStats) {
      console.log(`종목 ${stat.sport_type}의 팀 상세 정보 조회 중...`);
      
      let teamDetails;
      try {
        // Sequelize 모델을 직접 사용하여 팀 정보 조회
        const { TeamInfo } = require('../models');
        teamDetails = await TeamInfo.findAll({
          where: { sport_type: stat.sport_type },
          order: [['match_id', 'ASC'], ['team_type', 'ASC']]
        });
        console.log(`종목 ${stat.sport_type}의 팀 상세 정보:`, teamDetails.length, '개');
      } catch (error) {
        console.error(`종목 ${stat.sport_type}의 팀 정보 조회 실패:`, error);
        teamDetails = [];
      }
      
      console.log(`종목 ${stat.sport_type}의 팀 상세 정보:`, teamDetails);
      
      // teamDetails가 배열이 아닌 경우 배열로 변환
      const teamDetailsArray = Array.isArray(teamDetails) ? teamDetails : [teamDetails];
      
      detailedStats.push({
        sport_type: stat.sport_type,
        sport_name: stat.sport_name,
        sport_template: stat.sport_template,
        sport_description: stat.sport_description,
        sport_is_active: stat.sport_is_active,
        sport_is_default: stat.sport_is_default,
        sport_created_at: stat.sport_created_at,
        sport_updated_at: stat.sport_updated_at,
        match_count: stat.match_count,
        team_info_count: stat.team_info_count,
        logo_count: stat.logo_count,
        used_colors: stat.used_colors ? stat.used_colors.split(',') : [],
        first_created: stat.first_created,
        last_updated: stat.last_updated,
        team_details: teamDetailsArray
      });
    }
    
    // 3. Settings 테이블 데이터 조회 (Sequelize 모델 사용)
    console.log('Settings 테이블 데이터 조회 중...');
    let settingsData;
    try {
      const { Settings } = require('../models');
      settingsData = await Settings.findAll({
        order: [['created_at', 'DESC']]
      });
      console.log('Settings 테이블 데이터:', settingsData.length, '개');
    } catch (error) {
      console.error('Settings 테이블 조회 실패:', error);
      settingsData = [];
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
    console.log('요청 데이터:', { team_name, team_color, team_header, logo_path, logo_bg_color });
    console.log('요청 본문 전체:', req.body);
    
    // logo_path가 상대 경로인 경우 API 경로로 변환
    let processedLogoPath = logo_path;
    if (logo_path && !logo_path.startsWith('/api/')) {
      // TEAMLOGO/SOCCER/파일명.png -> /api/overlay-images/TEAMLOGO/SOCCER/파일명.png
      if (logo_path.startsWith('TEAMLOGO/')) {
        processedLogoPath = `/api/overlay-images/${logo_path}`;
        console.log(`로고 경로 변환: ${logo_path} -> ${processedLogoPath}`);
      }
    }
    
    // 1. TeamInfo 테이블에서 팀 정보 조회 (match_id와 team_type 확인용)
    console.log('TeamInfo 테이블 조회 시작...');
    let teamInfo;
    try {
      teamInfo = await sequelize.query(`
        SELECT match_id, team_type, sport_type 
        FROM "TeamInfo" 
        WHERE id = ?
      `, {
        replacements: [id],
        type: sequelize.QueryTypes.SELECT
      });
      console.log('TeamInfo 조회 결과:', teamInfo);
    } catch (dbError) {
      console.error('TeamInfo 테이블 조회 실패:', dbError);
      console.log('TeamInfo 테이블이 존재하지 않거나 접근할 수 없습니다.');
      
      // TeamInfo 테이블이 없는 경우 Match 테이블만 업데이트
      console.log('Match 테이블만 업데이트 시도...');
      const { Match } = require('../models');
      const match = await Match.findByPk(req.body.match_id || req.body.matchId);
      
      if (match) {
        // Match 테이블의 match_data JSON 필드에 팀 정보 저장
        const matchData = match.match_data || {};
        const teamKey = req.body.team_type === 'home' ? 'home_team' : 'away_team';
        const colorKey = req.body.team_type === 'home' ? 'home_team_color' : 'away_team_color';
        const headerKey = req.body.team_type === 'home' ? 'home_team_header' : 'away_team_header';
        const logoKey = req.body.team_type === 'home' ? 'home_team_logo' : 'away_team_logo';
        const logoBgKey = req.body.team_type === 'home' ? 'home_team_logo_bg' : 'away_team_logo_bg';
        
        matchData[teamKey] = team_name;
        matchData[colorKey] = team_color;
        matchData[headerKey] = team_header;
        matchData[logoKey] = processedLogoPath;
        matchData[logoBgKey] = logo_bg_color;
        
        await match.update({ match_data: matchData });
        console.log('Match 테이블 업데이트 완료 (TeamInfo 테이블 없음)');
        
        return res.json({ 
          success: true, 
          message: '팀 정보가 수정되었습니다. (Match 테이블만 업데이트)',
          warning: 'TeamInfo 테이블을 사용할 수 없어 Match 테이블에만 저장되었습니다.'
        });
      } else {
        return res.status(404).json({ 
          success: false, 
          message: '경기 정보를 찾을 수 없습니다.' 
        });
      }
    }
    
    if (teamInfo.length === 0) {
      console.log(`팀 정보를 찾을 수 없음: ID ${id}`);
      return res.status(404).json({ success: false, message: '팀 정보를 찾을 수 없습니다.' });
    }
    
    const { match_id, team_type, sport_type } = teamInfo[0];
    
    // 2. TeamInfo 테이블 업데이트
    const result = await sequelize.query(`
      UPDATE "TeamInfo" 
      SET team_name = ?, team_color = ?, team_header = ?, logo_path = ?, logo_bg_color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, {
      replacements: [team_name, team_color, team_header, processedLogoPath, logo_bg_color, id],
      type: sequelize.QueryTypes.UPDATE
    });
    
    const updatedRows = result[1]; // Sequelize UPDATE 결과에서 영향받은 행 수
    console.log(`업데이트된 행 수: ${updatedRows}`);
    
    if (updatedRows > 0) {
      console.log(`팀 정보 수정 완료: ID ${id}`);
      
      // 3. Matches 테이블도 업데이트 (실시간 동기화를 위해)
      console.log('Match 모델 로드 시도...');
      const { Match } = require('../models');
      console.log('Match 모델:', Match);
      const match = await Match.findByPk(match_id);
      console.log('Match 조회 결과:', match);
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
      console.log('WebSocket 인스턴스 확인...');
      const io = req.app.get('io'); // server.js에서 설정된 io 인스턴스
      console.log('WebSocket io 인스턴스:', io);
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
          logoPath: processedLogoPath,
          logoBgColor: logo_bg_color
        });
        
        console.log(`WebSocket 실시간 업데이트 이벤트 전송: room=${roomName}`);
      }
      
      console.log(`✅ 팀 정보 수정 성공: ID ${id}, 팀명: ${team_name}, 색상: ${team_color}`);
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
