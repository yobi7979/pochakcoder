const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { Match, User, Sport, Template, TeamInfo } = require('../models');

// 경기 관련 라우터
// 이 파일은 server.js에서 분리된 경기 관련 API들을 포함합니다.

// GET /api/matches - 모든 경기 조회
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    console.log('경기 목록 조회 요청 받음');
    
    let whereCondition = {};
    
    // 일반 사용자는 자신이 만든 경기만 볼 수 있음
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
    }
    
    const matches = await Match.findAll({
      where: whereCondition,
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'username', 'full_name'],
        required: false
      }],
      order: [['created_at', 'DESC']]
    });
    
    console.log(`조회된 경기 수: ${matches.length} (사용자: ${req.session.username})`);

    // 템플릿 기반 분류를 위해 Sport와 Template 정보 가져오기
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default'],
      order: [['id', 'ASC']]
    });
    const templates = await Template.findAll();
    
    // 템플릿 이름을 키로 하는 맵 생성
    const templateMap = {};
    templates.forEach(template => {
      templateMap[template.name] = template.sport_type;
    });
    
    // Sport 코드를 키로 하는 맵 생성
    const sportTemplateMap = {};
    sports.forEach(sport => {
      sportTemplateMap[sport.code] = templateMap[sport.template] || sport.template;
    });

    const matchesWithUrls = matches.map(match => {
      const matchData = match.toJSON();
      
      // 템플릿 기반 sport_type 결정
      let templateBasedSportType = matchData.sport_type;
      if (sportTemplateMap[matchData.sport_type]) {
        templateBasedSportType = sportTemplateMap[matchData.sport_type];
      }

      return {
        id: matchData.id,
        sport_type: matchData.sport_type,
        template_based_sport_type: templateBasedSportType,
        home_team: matchData.home_team,
        away_team: matchData.away_team,
        home_team_color: matchData.home_team_color,
        away_team_color: matchData.away_team_color,
        home_team_header: matchData.home_team_header,
        away_team_header: matchData.away_team_header,
        home_score: matchData.home_score,
        away_score: matchData.away_score,
        status: matchData.status,
        match_data: matchData.match_data,
        created_by: matchData.created_by,
        creator: matchData.creator,

        created_at: matchData.created_at,
        updated_at: matchData.updated_at,

        overlay_url: `/${match.sport_type.toLowerCase()}/${match.id}/overlay`,
        control_url: `/${match.sport_type.toLowerCase()}/${match.id}/control`
      };
    });

    console.log('경기 목록 조회 성공');
    res.json(matchesWithUrls);
  } catch (error) {
    console.error('경기 목록 조회 실패:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
}));

// GET /api/matches/score-csv - 경기 점수 CSV 다운로드
router.get('/score-csv', asyncHandler(async (req, res) => {
  try {
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });

    let csvContent = 'ID,홈팀,원정팀,홈점수,원정점수,상태,생성일\n';
    
    matches.forEach(match => {
      csvContent += `${match.id},${match.home_team},${match.away_team},${match.home_score},${match.away_score},${match.status},${match.created_at}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="matches_score.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('CSV 다운로드 실패:', error);
    res.status(500).json({ error: 'CSV 다운로드 중 오류가 발생했습니다.' });
  }
}));

// GET /api/matches/score-csv-by-lists - 경기 점수 CSV 다운로드 (리스트별)
router.get('/score-csv-by-lists', asyncHandler(async (req, res) => {
  try {
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });

    let csvContent = 'ID,홈팀,원정팀,홈점수,원정점수,상태,생성일\n';
    
    matches.forEach(match => {
      csvContent += `${match.id},${match.home_team},${match.away_team},${match.home_score},${match.away_score},${match.status},${match.created_at}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="matches_score_by_lists.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('CSV 다운로드 실패:', error);
    res.status(500).json({ error: 'CSV 다운로드 중 오류가 발생했습니다.' });
  }
}));

// DELETE /api/matches/by-tab - 탭별 경기 삭제
router.delete('/by-tab', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sport_type } = req.body;
    
    if (!sport_type) {
      return res.status(400).json({ error: '스포츠 타입이 필요합니다.' });
    }

    let whereCondition = { sport_type };
    
    // 일반 사용자는 자신이 만든 경기만 삭제할 수 있음
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
    }

    const deletedCount = await Match.destroy({
      where: whereCondition
    });

    console.log(`${sport_type} 경기 ${deletedCount}개 삭제됨`);
    res.json({ message: `${sport_type} 경기 ${deletedCount}개가 삭제되었습니다.` });
  } catch (error) {
    console.error('경기 삭제 실패:', error);
    res.status(500).json({ error: '경기 삭제 중 오류가 발생했습니다.' });
  }
}));

// DELETE /api/matches/all - 모든 경기 삭제
router.delete('/all', requireAuth, asyncHandler(async (req, res) => {
  try {
    let whereCondition = {};
    
    // 일반 사용자는 자신이 만든 경기만 삭제할 수 있음
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
    }

    const deletedCount = await Match.destroy({
      where: whereCondition
    });

    console.log(`모든 경기 ${deletedCount}개 삭제됨`);
    res.json({ message: `모든 경기 ${deletedCount}개가 삭제되었습니다.` });
  } catch (error) {
    console.error('경기 삭제 실패:', error);
    res.status(500).json({ error: '경기 삭제 중 오류가 발생했습니다.' });
  }
}));

// 🚨 중복 라우트 제거됨 - /:matchId 라우트로 통합
// GET /api/matches/:id - 개별 경기 조회 (중복 제거됨)
/*
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] 개별 경기 조회 요청: ID=${id}`);
    
    const match = await Match.findByPk(id);
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 권한 확인 제거: 오버레이 페이지에서도 접근 가능하도록
    // if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
    //   return res.status(403).json({ error: '권한이 없습니다.' });
    // }
    
    const username = req.session?.username || 'overlay';
    console.log(`[DEBUG] 경기 조회 성공: ${id} (사용자: ${username})`);
    res.json(match);
  } catch (error) {
    console.error('[DEBUG] 개별 경기 조회 실패:', error);
    res.status(500).json({ error: '경기 조회 중 오류가 발생했습니다.' });
  }
}));
*/

// PUT /api/matches/:id - 개별 경기 수정
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { sport_type, home_team, away_team, match_data, use_team_logos } = req.body;
    
    console.log(`[DEBUG] 개별 경기 수정 요청: ID=${id}`);
    
    const match = await Match.findByPk(id);
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 권한 확인: 일반 사용자는 자신이 만든 경기만 수정 가능
    if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    
    // 경기 정보 업데이트
    const updateData = {};
    if (sport_type) updateData.sport_type = sport_type;
    if (home_team) updateData.home_team = home_team;
    if (away_team) updateData.away_team = away_team;
    if (match_data) updateData.match_data = match_data;
    if (use_team_logos !== undefined) {
      if (!updateData.match_data) updateData.match_data = match.match_data || {};
      updateData.match_data.use_team_logos = use_team_logos;
    }
    
    await match.update(updateData);
    
    console.log(`[DEBUG] 경기 수정 성공: ${id} (사용자: ${req.session.username})`);
    res.json({ success: true, match });
  } catch (error) {
    console.error('[DEBUG] 개별 경기 수정 실패:', error);
    res.status(500).json({ error: '경기 수정 중 오류가 발생했습니다.' });
  }
}));

// POST /api/matches - 새 경기 생성
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sport_type, home_team, away_team, match_data, use_team_logos } = req.body;
    
    console.log(`[DEBUG] 새 경기 생성 요청: ${home_team} vs ${away_team} (${sport_type})`);
    
    if (!sport_type || !home_team || !away_team) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    // URL 생성 (sport_type + timestamp + random string)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const url = `${sport_type.toLowerCase()}-${timestamp}-${randomStr}`;

    // 기본 match_data 객체 설정
    let matchDataObj = match_data || {};

    // 동적 기본 팀 컬러 적용
    const { Settings } = require('../models');
    const settings = await Settings.findAll();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    const defaultColors = {
      home: settingsObj.default_home_color || '#FF0000',
      away: settingsObj.default_away_color || '#0000FF'
    };
    
    if (!matchDataObj.home_team_color) matchDataObj.home_team_color = defaultColors.home;
    if (!matchDataObj.away_team_color) matchDataObj.away_team_color = defaultColors.away;

    // 기본 팀 헤더 설정
    if (!matchDataObj.home_team_header) matchDataObj.home_team_header = home_team;
    if (!matchDataObj.away_team_header) matchDataObj.away_team_header = away_team;

    // 팀 로고 사용 여부 설정
    if (use_team_logos !== undefined) {
      matchDataObj.use_team_logos = use_team_logos;
    }

    const match = await Match.create({
      sport_type,
      home_team,
      away_team,
      home_team_color: matchDataObj.home_team_color,
      away_team_color: matchDataObj.away_team_color,
      home_team_header: matchDataObj.home_team_header,
      away_team_header: matchDataObj.away_team_header,
      home_score: 0,
      away_score: 0,
      status: 'scheduled',
      match_data: matchDataObj,
      created_by: req.session.userId
    });
    
    // TeamInfo 자동 생성 (홈팀과 어웨이팀)
    await TeamInfo.bulkCreate([
      {
        match_id: match.id,
        sport_type: sport_type,
        team_name: home_team,
        team_type: 'home',
        team_color: matchDataObj.home_team_color,
        team_header: matchDataObj.home_team_header,
        logo_path: null, // 기본값: null (나중에 기본 이미지 지정 예정)
        logo_bg_color: '#FFFFFF' // 기본값: 흰색
      },
      {
        match_id: match.id,
        sport_type: sport_type,
        team_name: away_team,
        team_type: 'away',
        team_color: matchDataObj.away_team_color,
        team_header: matchDataObj.away_team_header,
        logo_path: null, // 기본값: null (나중에 기본 이미지 지정 예정)
        logo_bg_color: '#FFFFFF' // 기본값: 흰색
      }
    ]);
    
    // Settings 테이블에 팀로고 사용 상태 저장 (컨트롤 페이지와 연동)
    if (use_team_logos !== undefined) {
      const { Settings } = require('../models');
      await Settings.upsert({
        key: `soccer_team_logo_visibility_${match.id}`,
        value: use_team_logos.toString()
      });
      console.log(`Settings 테이블에 팀로고 사용 상태 저장: ${match.id}, use_team_logos: ${use_team_logos}`);
    }

    console.log(`새 경기 생성: ${home_team} vs ${away_team} (${sport_type}) by user ${req.session.userId}`);
    console.log(`TeamInfo 자동 생성 완료: 홈팀(${home_team}), 어웨이팀(${away_team})`);
    res.json({ success: true, match });
  } catch (error) {
    console.error('경기 생성 실패:', error);
    res.status(500).json({ error: '경기 생성에 실패했습니다.' });
  }
}));

// POST /api/matches/:matchId/swap-teams - 경기 팀 위치 변경
router.post('/:matchId/swap-teams', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { Match } = require('../models');
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 팀 정보 교체
    const tempHomeTeam = match.home_team;
    const tempHomeScore = match.home_score;
    const tempAwayTeam = match.away_team;
    const tempAwayScore = match.away_score;
    
    // 팀 컬러도 교체 (match_data에서)
    const matchData = match.match_data || {};
    const tempHomeTeamColor = matchData.home_team_color;
    const tempAwayTeamColor = matchData.away_team_color;
    
    console.log('=== 팀 컬러 교체 시작 ===');
    console.log('기존 홈팀 컬러:', tempHomeTeamColor);
    console.log('기존 어웨이팀 컬러:', tempAwayTeamColor);
    
    // 팀 컬러도 함께 교체
    const updatedMatchData = {
      ...matchData,
      home_team_color: tempAwayTeamColor,
      away_team_color: tempHomeTeamColor
    };
    
    console.log('교체 후 홈팀 컬러:', updatedMatchData.home_team_color);
    console.log('교체 후 어웨이팀 컬러:', updatedMatchData.away_team_color);
    console.log('=== 팀 컬러 교체 완료 ===');
    
    await match.update({
      home_team: tempAwayTeam,
      home_score: tempAwayScore,
      away_team: tempHomeTeam,
      away_score: tempHomeScore,
      match_data: updatedMatchData
    });
    
    // WebSocket으로 팀 위치 변경 이벤트 전송
    const io = require('../server').getIO();
    const roomName = `match_${matchId}`;
    io.to(roomName).emit('teamsSwapped', {
      matchId: matchId,
      home_team: tempAwayTeam,
      away_team: tempHomeTeam,
      home_score: tempAwayScore,
      away_score: tempHomeScore
    });
    
    console.log(`팀 위치 변경 완료: ${matchId}, 홈팀: ${tempAwayTeam}, 어웨이팀: ${tempHomeTeam}`);
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('팀 위치 변경 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/matches/:matchId/team-name - 경기 팀명 수정
router.post('/:matchId/team-name', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { team, teamName } = req.body;
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 팀명 업데이트
    if (team === 'home') {
      await match.update({ home_team: teamName });
    } else if (team === 'away') {
      await match.update({ away_team: teamName });
    }
    
    // TeamInfo 테이블도 업데이트 (DB 관리 페이지와 동기화)
    const { sequelize } = require('../models');
    await sequelize.query(`
      UPDATE TeamInfo 
      SET team_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE match_id = ? AND team_type = ?
    `, {
      replacements: [teamName, matchId, team],
      type: sequelize.QueryTypes.UPDATE
    });
    
    console.log(`TeamInfo 테이블 동기화 완료: matchId=${matchId}, teamType=${team}, teamName=${teamName}`);
    
    // WebSocket으로 팀명 업데이트 이벤트 전송
    const io = require('../server').getIO();
    const roomName = `match_${matchId}`;
    io.to(roomName).emit('teamNameUpdated', {
      matchId: matchId,
      team: team,
      teamName: teamName
    });
    
    console.log(`팀명 업데이트 완료: ${matchId}, ${team}팀: ${teamName}`);
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('팀명 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/matches/:matchId/team-color - 경기 팀 컬러 수정
router.post('/:matchId/team-color', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { team, teamColor, headerText } = req.body;
    
    console.log(`팀 컬러 수정 요청: ${matchId}, ${team}팀, 컬러: ${teamColor}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 팀 컬러 업데이트
    if (team === 'home') {
      await match.update({ 
        home_team_color: teamColor,
        home_team_header: headerText || match.home_team_header
      });
    } else if (team === 'away') {
      await match.update({ 
        away_team_color: teamColor,
        away_team_header: headerText || match.away_team_header
      });
    }
    
    // TeamInfo 테이블도 업데이트 (DB 관리 페이지와 동기화)
    const { sequelize } = require('../models');
    const { TeamInfo } = require('../models');
    
    // Sequelize ORM을 사용하여 안전하게 업데이트
    await TeamInfo.update({
      team_color: teamColor,
      team_header: headerText || (team === 'home' ? match.home_team_header : match.away_team_header)
    }, {
      where: {
        match_id: matchId,
        team_type: team
      }
    });
    
    // WebSocket으로 팀 컬러 업데이트 이벤트 전송
    const io = require('../server').getIO();
    const roomName = `match_${matchId}`;
    io.to(roomName).emit('teamColorUpdated', {
      matchId: matchId,
      teamType: team,
      teamColor: teamColor,
      headerText: headerText
    });
    
    console.log(`팀 컬러 업데이트 완료: ${matchId}, ${team}팀, 컬러: ${teamColor}`);
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('팀 컬러 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/matches/:matchId - 개별 경기 조회
router.get('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`[DEBUG] 개별 경기 조회 요청: ID=${matchId}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    console.log(`[DEBUG] 경기 조회 성공: ${matchId} (사용자: ${req.session.username})`);
    res.json(match);
  } catch (error) {
    console.error('개별 경기 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/matches/:matchId/tournament-text - 토너먼트 텍스트 조회
router.get('/:matchId/tournament-text', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`토너먼트 텍스트 조회: ${matchId}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const tournamentText = match.match_data?.tournament_text || '';
    res.json({ success: true, tournamentText });
  } catch (error) {
    console.error('토너먼트 텍스트 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/matches/:matchId/team-logos - 팀로고 정보 조회
router.get('/:matchId/team-logos', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`팀로고 정보 조회: ${matchId}`);
    
    // Sequelize 모델 사용으로 변경
    const { TeamInfo } = require('../models');
    
    // TeamInfo 모델이 존재하는지 확인
    if (!TeamInfo) {
      console.error('TeamInfo 모델이 로드되지 않았습니다.');
      return res.status(500).json({ 
        success: false, 
        error: 'TeamInfo 모델을 찾을 수 없습니다.' 
      });
    }
    
    // TeamInfo 테이블에서 팀로고 정보 조회
    const teamLogos = await TeamInfo.findAll({
      where: { match_id: matchId },
      order: [['team_type', 'ASC']]
    });
    
    console.log(`팀로고 정보 조회 완료: ${matchId}, 팀 수: ${teamLogos.length}`);
    console.log('팀로고 상세 정보:', teamLogos.map(team => ({
      team_type: team.team_type,
      logo_path: team.logo_path,
      logo_bg_color: team.logo_bg_color,
      team_name: team.team_name
    })));
    
    res.json({ success: true, teamLogos });
  } catch (error) {
    console.error('팀로고 정보 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// POST /api/matches/:matchId/team-logo-bg - 팀 로고 배경색 수정
router.post('/:matchId/team-logo-bg', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { team, logoBgColor } = req.body;

    console.log(`팀 로고 배경색 수정 요청: ${matchId}, ${team}팀, 배경색: ${logoBgColor}`);

    // Sequelize 모델 사용으로 변경
    const { TeamInfo } = require('../models');
    
    // TeamInfo 모델이 존재하는지 확인
    if (!TeamInfo) {
      console.error('TeamInfo 모델이 로드되지 않았습니다.');
      return res.status(500).json({ 
        success: false, 
        error: 'TeamInfo 모델을 찾을 수 없습니다.' 
      });
    }

    // TeamInfo 테이블에서 해당 팀 정보 찾기
    const teamInfo = await TeamInfo.findOne({
      where: { 
        match_id: matchId, 
        team_type: team 
      }
    });

    if (!teamInfo) {
      console.log(`팀 정보를 찾을 수 없음: matchId=${matchId}, teamType=${team}`);
      return res.status(404).json({ 
        success: false, 
        message: '팀 정보를 찾을 수 없습니다.' 
      });
    }

    // 로고 배경색 업데이트
    await teamInfo.update({
      logo_bg_color: logoBgColor
    });

    console.log(`TeamInfo 테이블 로고 배경색 동기화 완료: matchId=${matchId}, teamType=${team}, logoBgColor=${logoBgColor}`);

    // WebSocket을 통한 실시간 업데이트 이벤트 전송
    const io = req.app.get('io');
    if (io) {
      const roomName = `match_${matchId}`;
      io.to(roomName).emit('teamLogoUpdated', {
        matchId: matchId,
        teamType: team,
        logoBgColor: logoBgColor
      });
      console.log(`WebSocket 팀 로고 배경색 업데이트 이벤트 전송: room=${roomName}`);
    }
    
    res.json({ 
      success: true, 
      message: '로고 배경색이 성공적으로 저장되었습니다.', 
      logoBgColor: logoBgColor 
    });
  } catch (error) {
    console.error('팀 로고 배경색 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      message: '로고 배경색 업데이트 중 서버 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// GET /api/matches/:matchId/load-lineup - 라인업 조회
router.get('/:matchId/load-lineup', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`라인업 조회: ${matchId}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const lineup = match.match_data?.lineup || { home: [], away: [] };
    res.json({ success: true, lineup });
  } catch (error) {
    console.error('라인업 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/matches/save-lineup - 라인업 저장
router.post('/save-lineup', async (req, res) => {
  try {
    const { matchId, lineup } = req.body;
    console.log(`라인업 저장: ${matchId}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const matchData = match.match_data || {};
    matchData.lineup = lineup;
    
    await match.update({ match_data: matchData });
    
    console.log(`라인업 저장 완료: ${matchId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('라인업 저장 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// PUT /api/matches/:matchId - 경기 정보 업데이트
router.put('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const updateData = req.body;
    
    console.log(`경기 정보 업데이트: ${matchId}`, updateData);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    await match.update(updateData);
    
    console.log(`경기 정보 업데이트 완료: ${matchId}`);
    res.json({ success: true, match });
  } catch (error) {
    console.error('경기 정보 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/matches/:matchId - 경기 정보 업데이트 (POST 방식)
router.post('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const updateData = req.body;
    
    console.log(`경기 정보 업데이트 (POST): ${matchId}`, updateData);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    await match.update(updateData);
    
    console.log(`경기 정보 업데이트 완료 (POST): ${matchId}`);
    res.json({ success: true, match });
  } catch (error) {
    console.error('경기 정보 업데이트 실패 (POST):', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/matches/:id - 개별 경기 삭제
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    console.log(`[DEBUG] DELETE /api/matches/:id 라우트 매칭됨 - ID: ${req.params.id}`);
    console.log(`[DEBUG] 요청 URL: ${req.url}`);
    console.log(`[DEBUG] 요청 메서드: ${req.method}`);
    console.log(`[DEBUG] 요청 경로: ${req.path}`);
    console.log(`[DEBUG] 전체 요청 정보:`, {
      method: req.method,
      url: req.url,
      path: req.path,
      params: req.params,
      query: req.query
    });
    
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      console.log(`[DEBUG] 경기를 찾을 수 없음: ${req.params.id}`);
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }

    console.log(`[DEBUG] 경기 찾음: ${match.id}, 생성자: ${match.created_by}`);

    // 일반 사용자는 자신이 만든 경기만 삭제 가능
    if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
      console.log(`[DEBUG] 삭제 권한 없음: 사용자 ${req.session.userId}, 경기 생성자 ${match.created_by}`);
      return res.status(403).json({ error: '이 경기를 삭제할 권한이 없습니다.' });
    }

    await match.destroy();
    console.log(`[DEBUG] 경기 삭제 완료: ${match.id} (사용자: ${req.session.username})`);
    res.json({ success: true, message: '경기가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('[DEBUG] 경기 삭제 실패:', error);
    res.status(500).json({ error: '경기 삭제 중 오류가 발생했습니다.' });
  }
}));

// GET /api/matches/:matchId/team-logo-display-mode - 팀로고 표시 모드 조회
router.get('/:matchId/team-logo-display-mode', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`축구 팀로고 표시 모드 조회: ${matchId}`);
    
    // Settings 테이블에서 팀로고 표시 모드 조회
    const { Settings } = require('../models');
    const setting = await Settings.findOne({
      where: { key: `soccer_team_logo_display_mode_${matchId}` }
    });
    
    const displayMode = setting ? setting.value : 'logo'; // 기본값은 'logo' (로고+배경)
    
    console.log(`축구 팀로고 표시 모드: ${displayMode}`);
    res.json({ success: true, displayMode: displayMode });
  } catch (error) {
    console.error('축구 팀로고 표시 모드 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/matches/:matchId/team-logo-display-mode - 팀로고 표시 모드 저장
router.post('/:matchId/team-logo-display-mode', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { displayMode } = req.body;
    
    console.log(`축구 팀로고 표시 모드 저장: ${matchId}, displayMode: ${displayMode}`);
    
    // Settings 테이블에 팀로고 표시 모드 저장
    const { Settings } = require('../models');
    await Settings.upsert({
      key: `soccer_team_logo_display_mode_${matchId}`,
      value: displayMode
    });
    
    // WebSocket으로 실시간 업데이트
    const io = req.app.get('io');
    if (io) {
      const roomName = `match_${matchId}`;
      io.to(roomName).emit('teamLogoDisplayModeChanged', {
        matchId: matchId,
        displayMode: displayMode
      });
      console.log(`WebSocket 팀로고 표시 모드 업데이트 이벤트 전송: room=${roomName}, displayMode=${displayMode}`);
    }
    
    console.log(`축구 팀로고 표시 모드 저장 완료: ${matchId}, displayMode: ${displayMode}`);
    res.json({ success: true, displayMode: displayMode });
  } catch (error) {
    console.error('축구 팀로고 표시 모드 저장 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
