const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들 - TeamInfo 기반으로 변경
const { TeamInfo, Match, Op } = require('../models');

// RGB를 HEX로 변환하는 함수
function rgbToHex(rgb) {
  if (!rgb) return '#ffffff';
  
  // 이미 HEX 형식인 경우
  if (rgb.startsWith('#')) {
    return rgb;
  }
  
  // RGB 형식인 경우 변환
  if (rgb.startsWith('rgb(')) {
    const matches = rgb.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }
  
  // 기본값 반환
  return '#ffffff';
}

// ========================================
// 통합 팀로고 시스템 API
// ========================================

// GET /api/team-logos/:sportType - 종목별 팀로고 목록 조회 (데이터베이스 + 파일시스템)
router.get('/:sportType', asyncHandler(async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`🔧 종목별 팀로고 목록 조회: ${sportType}`);
    
    const fs = require('fs');
    const path = require('path');
    
    // 1. TeamInfo 테이블에서 팀로고 조회 (중복 제거)
    const dbTeamLogos = await TeamInfo.findAll({
      where: { 
        sport_type: sportType.toUpperCase(),
        logo_path: { 
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: '' },
            { [Op.ne]: undefined }
          ]
        }
      },
      attributes: ['team_name', 'logo_path', 'logo_bg_color'],
      group: ['team_name', 'logo_path', 'logo_bg_color'], // 중복 제거
      order: [['team_name', 'ASC']]
    });

    // 파일 이름 추출하여 표시용 이름 생성
    const processedDbTeamLogos = dbTeamLogos
      .filter(logo => logo.logo_path && logo.logo_path.trim() !== '') // logo_path가 유효한 것만 필터링
      .map(logo => {
        // logo_path에서 파일 이름 추출
        const pathParts = logo.logo_path.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const displayName = path.parse(fileName).name; // 확장자 제거
        
        return {
          ...logo,
          display_name: displayName, // 표시용 이름 (파일 이름)
          original_team_name: logo.team_name // 원본 팀 이름 보존
        };
      });
    
    // 2. 파일시스템에서 팀로고 조회
    const fileSystemLogos = [];
    // Railway Volume 경로 우선 사용
    const baseDir = process.env.VOLUME_STORAGE_PATH ? 
      path.join(process.env.VOLUME_STORAGE_PATH, 'TEAMLOGO') : 
      path.join(__dirname, '../public/TEAMLOGO');
    const sportDir = path.join(baseDir, sportType.toUpperCase());
    
    console.log(`🔧 팀로고 파일시스템 스캔: ${sportType}`, {
      VOLUME_STORAGE_PATH: process.env.VOLUME_STORAGE_PATH,
      baseDir: baseDir,
      sportDir: sportDir,
      exists: fs.existsSync(sportDir)
    });
    
    if (fs.existsSync(sportDir)) {
      const files = fs.readdirSync(sportDir);
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
      });
      
      imageFiles.forEach(file => {
        const fileName = path.parse(file).name; // 확장자 제거
        // 한글 파일명 처리를 위한 경로 생성
        const logoPath = `/api/overlay-images/TEAMLOGO/${sportType.toUpperCase()}/${file}`;
        
        // 데이터베이스에 이미 있는지 확인 (더 정확한 중복 체크)
        const existsInDb = processedDbTeamLogos.some(dbLogo => {
          // logo_path 비교
          if (dbLogo.logo_path === logoPath) return true;
          // display_name 비교 (파일 이름)
          if (dbLogo.display_name === fileName) return true;
          // team_name 비교
          if (dbLogo.team_name === fileName) return true;
          return false;
        });
        
        if (!existsInDb) {
          fileSystemLogos.push({
            id: `file_${fileName}`,
            sport_type: sportType.toUpperCase(),
            team_name: fileName,
            display_name: fileName, // 표시용 이름 (파일 이름)
            logo_path: logoPath,
            logo_bg_color: '#ffffff',
            is_active: true,
            is_file_system: true
          });
        }
      });
    }
    
    // 3. 데이터베이스와 파일시스템 로고 합치기
    const allTeamLogos = [...processedDbTeamLogos, ...fileSystemLogos];
    
    console.log(`✅ ${sportType} 팀로고 ${allTeamLogos.length}개 조회 완료 (DB: ${dbTeamLogos.length}, 파일: ${fileSystemLogos.length})`);
    console.log('🔧 DB 로고 목록:', processedDbTeamLogos.map(logo => ({ 
      team_name: logo.team_name, 
      display_name: logo.display_name, 
      logo_path: logo.logo_path 
    })));
    console.log('🔧 파일시스템 로고 목록:', fileSystemLogos.map(logo => ({ 
      team_name: logo.team_name, 
      display_name: logo.display_name, 
      logo_path: logo.logo_path 
    })));
    res.json({ success: true, teamLogos: allTeamLogos });
  } catch (error) {
    console.error('종목별 팀로고 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '팀로고 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

// GET /api/matches/:matchId/team-logos - 경기별 팀로고 정보 조회 (TeamInfo 기반)
router.get('/:matchId/team-logos', asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`🔧 경기별 팀로고 정보 조회: ${matchId}`);
    
    // TeamInfo 테이블에서 경기별 팀 정보 조회
    const teamInfos = await TeamInfo.findAll({
      where: { match_id: matchId },
      order: [['team_type', 'ASC']]
    });
    
    const teamLogos = teamInfos.map(teamInfo => ({
      team_type: teamInfo.team_type,
      logo_path: teamInfo.logo_path,
      logo_bg_color: teamInfo.logo_bg_color,
      team_name: teamInfo.team_name
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

// POST /api/team-logos/:matchId/select - 경기 팀로고 선택 (TeamInfo 기반)
router.post('/:matchId/select', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    const { teamType, logoPath, teamName, bgColor } = req.body;
    console.log(`🔧 경기 팀로고 선택: ${matchId} - ${teamType}팀`);
    
    // 경기 존재 확인
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: '경기를 찾을 수 없습니다.'
      });
    }
    
    // 기존 TeamInfo 레코드 찾기
    const existingTeamInfo = await TeamInfo.findOne({
      where: {
        match_id: matchId,
        team_type: teamType
      }
    });
    
    if (existingTeamInfo) {
      // 기존 팀 정보 업데이트 (경기 생성 시 이미 TeamInfo 레코드가 생성됨)
      await existingTeamInfo.update({
        sport_type: match.sport_type,
        team_name: teamName,
        logo_path: logoPath,
        logo_bg_color: rgbToHex(bgColor)
      });
      console.log(`🔧 기존 TeamInfo 레코드 업데이트: ID ${existingTeamInfo.id}`);
    } else {
      // TeamInfo 레코드가 없는 경우 (경기 생성 시 자동 생성되어야 함)
      console.error(`❌ TeamInfo 레코드가 없음: matchId=${matchId}, teamType=${teamType}`);
      console.error(`❌ 경기 생성 시 TeamInfo 레코드가 자동 생성되어야 합니다.`);
      
      // 임시로 새 레코드 생성 (정상적인 경우라면 발생하지 않아야 함)
      const newTeamInfo = await TeamInfo.create({
        match_id: matchId,
        sport_type: match.sport_type,
        team_name: teamName,
        team_type: teamType,
        logo_path: logoPath,
        logo_bg_color: rgbToHex(bgColor)
      });
      console.log(`⚠️ TeamInfo 임시 레코드 생성: ID ${newTeamInfo.id}, ${matchId} - ${teamType}팀`);
    }
    
    console.log(`✅ 경기 ${matchId} ${teamType}팀 로고 선택 완료: ${teamName}`);
    res.json({ 
      success: true, 
      message: '팀로고가 성공적으로 선택되었습니다.',
      teamLogo: {
        team_type: teamType,
        logo_path: logoPath,
        logo_bg_color: bgColor,
        team_name: teamName
      }
    });
  } catch (error) {
    console.error('경기 팀로고 선택 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '경기 팀로고 선택에 실패했습니다.',
      error: error.message 
    });
  }
}));

// POST /api/team-logos - 새 팀로고 생성 (더 이상 사용되지 않음)
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  res.status(400).json({
    success: false,
    message: '이 API는 더 이상 사용되지 않습니다. TeamInfo 기반으로 변경되었습니다.'
  });
}));

// PUT /api/matches/:matchId/team-logos - 경기 팀로고 설정 (TeamInfo 기반)
router.put('/:matchId/team-logos', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    const { home_team_logo_path, away_team_logo_path, home_team_name, away_team_name, home_logo_bg_color, away_logo_bg_color } = req.body;
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
    
    // 홈팀 정보 업데이트
    if (home_team_logo_path) {
      const existingHomeTeamInfo = await TeamInfo.findOne({
        where: {
          match_id: matchId,
          team_type: 'home'
        }
      });
      
      if (existingHomeTeamInfo) {
        // 기존 팀 정보 업데이트 (경기 생성 시 이미 TeamInfo 레코드가 생성됨)
        await existingHomeTeamInfo.update({
          sport_type: match.sport_type,
          team_name: home_team_name || match.home_team,
          logo_path: home_team_logo_path,
          logo_bg_color: home_logo_bg_color || '#ffffff'
        });
        console.log(`🔧 홈팀 기존 레코드 업데이트: ID ${existingHomeTeamInfo.id}`);
      } else {
        // TeamInfo 레코드가 없는 경우 (경기 생성 시 자동 생성되어야 함)
        console.error(`❌ 홈팀 TeamInfo 레코드가 없음: matchId=${matchId}`);
        console.error(`❌ 경기 생성 시 TeamInfo 레코드가 자동 생성되어야 합니다.`);
        
        // 임시로 새 레코드 생성 (정상적인 경우라면 발생하지 않아야 함)
        const newHomeTeamInfo = await TeamInfo.create({
          match_id: matchId,
          sport_type: match.sport_type,
          team_name: home_team_name || match.home_team,
          team_type: 'home',
          logo_path: home_team_logo_path,
          logo_bg_color: home_logo_bg_color || '#ffffff'
        });
        console.log(`⚠️ 홈팀 TeamInfo 임시 레코드 생성: ID ${newHomeTeamInfo.id}, ${matchId}`);
      }
    }
    
    // 어웨이팀 정보 업데이트
    if (away_team_logo_path) {
      const existingAwayTeamInfo = await TeamInfo.findOne({
        where: {
          match_id: matchId,
          team_type: 'away'
        }
      });
      
      if (existingAwayTeamInfo) {
        // 기존 팀 정보 업데이트 (경기 생성 시 이미 TeamInfo 레코드가 생성됨)
        await existingAwayTeamInfo.update({
          sport_type: match.sport_type,
          team_name: away_team_name || match.away_team,
          logo_path: away_team_logo_path,
          logo_bg_color: away_logo_bg_color || '#ffffff'
        });
        console.log(`🔧 어웨이팀 기존 레코드 업데이트: ID ${existingAwayTeamInfo.id}`);
      } else {
        // TeamInfo 레코드가 없는 경우 (경기 생성 시 자동 생성되어야 함)
        console.error(`❌ 어웨이팀 TeamInfo 레코드가 없음: matchId=${matchId}`);
        console.error(`❌ 경기 생성 시 TeamInfo 레코드가 자동 생성되어야 합니다.`);
        
        // 임시로 새 레코드 생성 (정상적인 경우라면 발생하지 않아야 함)
        const newAwayTeamInfo = await TeamInfo.create({
          match_id: matchId,
          sport_type: match.sport_type,
          team_name: away_team_name || match.away_team,
          team_type: 'away',
          logo_path: away_team_logo_path,
          logo_bg_color: away_logo_bg_color || '#ffffff'
        });
        console.log(`⚠️ 어웨이팀 TeamInfo 임시 레코드 생성: ID ${newAwayTeamInfo.id}, ${matchId}`);
      }
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

// DELETE /api/team-logos/:id - 팀로고 삭제 (더 이상 사용되지 않음)
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.status(400).json({
    success: false,
    message: '이 API는 더 이상 사용되지 않습니다. TeamInfo 기반으로 변경되었습니다.'
  });
}));

// GET /api/team-logos/config/:sportType - 종목별 설정 조회
router.get('/config/:sportType', asyncHandler(async (req, res) => {
  try {
    const { sportType } = req.params;
    console.log(`🔧 종목별 설정 조회: ${sportType}`);
    
    // TeamInfo 기반으로 변경되어 기본 설정값 반환
    const config = {
      sport_type: sportType.toUpperCase(),
      default_logo_size: '40px',
      default_bg_color: '#ffffff',
      logo_upload_path: '/TEAMLOGO'
    };
    
    console.log(`✅ ${sportType} 설정 조회 완료 (기본값)`);
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

// 중복된 API 제거됨 - 위의 POST /:matchId/select API 사용

module.exports = router;
