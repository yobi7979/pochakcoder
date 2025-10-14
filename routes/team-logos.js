const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { TeamLogo, MatchTeamLogo, Match, SportTeamLogoConfig, Op } = require('../models');

// ========================================
// 통합 팀로고 시스템 API
// ========================================

// GET /api/team-logos/:sportType - 종목별 팀로고 목록 조회
router.get('/:sportType', asyncHandler(async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`🔧 종목별 팀로고 목록 조회: ${sportType}`);
    
    const teamLogos = await TeamLogo.findAll({
      where: { 
        sport_type: sportType.toUpperCase(),
        is_active: true 
      },
      order: [['team_name', 'ASC']]
    });
    
    console.log(`✅ ${sportType} 팀로고 ${teamLogos.length}개 조회 완료`);
    res.json({ success: true, teamLogos });
  } catch (error) {
    console.error('종목별 팀로고 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '팀로고 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

// GET /api/matches/:matchId/team-logos - 경기별 팀로고 정보 조회
router.get('/:matchId/team-logos', asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`🔧 경기별 팀로고 정보 조회: ${matchId}`);
    
    const matchTeamLogos = await MatchTeamLogo.findAll({
      where: { match_id: matchId },
      include: [{
        model: TeamLogo,
        as: 'teamLogo'
      }]
    });
    
    const teamLogos = matchTeamLogos.map(mtl => ({
      team_type: mtl.team_type,
      logo_path: mtl.teamLogo.logo_path,
      logo_bg_color: mtl.teamLogo.logo_bg_color,
      team_name: mtl.teamLogo.team_name
    }));
    
    console.log(`✅ 경기 ${matchId} 팀로고 ${teamLogos.length}개 조회 완료`);
    res.json({ success: true, teamLogos });
  } catch (error) {
    console.error('경기별 팀로고 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '경기별 팀로고 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

// POST /api/team-logos - 새 팀로고 생성
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sport_type, team_name, logo_path, logo_bg_color } = req.body;
    console.log(`🔧 새 팀로고 생성: ${sport_type} - ${team_name}`);
    
    // 중복 확인
    const existingLogo = await TeamLogo.findOne({
      where: {
        sport_type: sport_type.toUpperCase(),
        team_name: team_name
      }
    });
    
    if (existingLogo) {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 팀로고입니다.'
      });
    }
    
    const teamLogo = await TeamLogo.create({
      sport_type: sport_type.toUpperCase(),
      team_name,
      logo_path,
      logo_bg_color: logo_bg_color || '#ffffff'
    });
    
    console.log(`✅ 팀로고 생성 완료: ID ${teamLogo.id}`);
    res.json({ success: true, teamLogo });
  } catch (error) {
    console.error('팀로고 생성 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '팀로고 생성에 실패했습니다.',
      error: error.message 
    });
  }
}));

// PUT /api/matches/:matchId/team-logos - 경기 팀로고 설정
router.put('/:matchId/team-logos', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    const { home_team_logo_id, away_team_logo_id } = req.body;
    console.log(`🔧 경기 팀로고 설정: ${matchId}`);
    
    // 경기 존재 확인
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: '경기를 찾을 수 없습니다.'
      });
    }
    
    // 권한 확인
    if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }
    
    // 기존 연결 삭제
    await MatchTeamLogo.destroy({ where: { match_id: matchId } });
    
    // 새 연결 생성
    if (home_team_logo_id) {
      await MatchTeamLogo.create({
        match_id: matchId,
        team_type: 'home',
        team_logo_id: home_team_logo_id
      });
    }
    
    if (away_team_logo_id) {
      await MatchTeamLogo.create({
        match_id: matchId,
        team_type: 'away',
        team_logo_id: away_team_logo_id
      });
    }
    
    console.log(`✅ 경기 ${matchId} 팀로고 설정 완료`);
    res.json({ success: true });
  } catch (error) {
    console.error('경기 팀로고 설정 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '경기 팀로고 설정에 실패했습니다.',
      error: error.message 
    });
  }
}));

// DELETE /api/team-logos/:id - 팀로고 삭제
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔧 팀로고 삭제: ID ${id}`);
    
    const teamLogo = await TeamLogo.findByPk(id);
    if (!teamLogo) {
      return res.status(404).json({
        success: false,
        message: '팀로고를 찾을 수 없습니다.'
      });
    }
    
    // 권한 확인 (관리자만 삭제 가능)
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }
    
    await teamLogo.destroy();
    
    console.log(`✅ 팀로고 삭제 완료: ID ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('팀로고 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '팀로고 삭제에 실패했습니다.',
      error: error.message 
    });
  }
}));

// GET /api/team-logos/config/:sportType - 종목별 설정 조회
router.get('/config/:sportType', asyncHandler(async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`🔧 종목별 설정 조회: ${sportType}`);
    
    let config = await SportTeamLogoConfig.findOne({
      where: { sport_type: sportType.toUpperCase() }
    });
    
    // 설정이 없으면 기본값으로 생성
    if (!config) {
      config = await SportTeamLogoConfig.create({
        sport_type: sportType.toUpperCase(),
        default_logo_size: '40px',
        default_bg_color: '#ffffff',
        logo_upload_path: '/TEAMLOGO'
      });
    }
    
    console.log(`✅ ${sportType} 설정 조회 완료`);
    res.json({ success: true, config });
  } catch (error) {
    console.error('종목별 설정 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '종목별 설정 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

module.exports = router;
