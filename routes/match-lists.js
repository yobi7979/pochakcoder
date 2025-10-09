const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { MatchList, Match, User } = require('../models');

// 경기 목록 관련 라우터
// 이 파일은 server.js에서 분리된 경기 목록 관련 API들을 포함합니다.

// GET /api/match-lists - 경기 목록 조회
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    console.log('[DEBUG] 경기 목록 조회 요청 받음');
    
    const matchLists = await MatchList.findAll({
      attributes: ['id', 'name', 'matches', 'custom_url', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']]
    });
    
    console.log(`[DEBUG] 조회된 경기 목록 수: ${matchLists.length} (사용자: ${req.session.username})`);
    res.json(matchLists);
  } catch (error) {
    console.error('[DEBUG] 경기 목록 조회 실패:', error);
    res.status(500).json({ error: '경기 목록 조회에 실패했습니다.' });
  }
}));

// POST /api/match-lists - 경기 목록 생성
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { name, custom_url } = req.body;
    
    console.log(`[DEBUG] 경기 목록 생성 요청: name=${name}, custom_url=${custom_url}`);
    
    if (!name) {
      return res.status(400).json({ error: '목록 이름이 필요합니다.' });
    }
    
    // PostgreSQL 호환성을 위한 필드 제한 (created_by 제외)
    const matchListData = {
      name,
      custom_url: custom_url || null,
      matches: []
      // created_by 필드 제거 - PostgreSQL 외래 키 제약 조건 문제 방지
    };
    
    console.log(`[DEBUG] 생성할 데이터:`, matchListData);
    
    const matchList = await MatchList.create(matchListData);
    
    console.log(`[DEBUG] 경기 목록 생성 성공: ${matchList.id} (사용자: ${req.session.username})`);
    res.json({ success: true, matchList: matchList });
  } catch (error) {
    console.error('[DEBUG] 경기 목록 생성 실패:', error);
    console.error('[DEBUG] 오류 상세:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ 
      error: '경기 목록 생성 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
}));

// GET /api/match-lists/:id - 개별 경기 목록 조회
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] 개별 경기 목록 조회 요청: ID=${id}`);
    
    const matchList = await MatchList.findByPk(id);
    
    if (!matchList) {
      return res.status(404).json({ error: '경기 목록을 찾을 수 없습니다.' });
    }
    
    // 권한 확인: 일반 사용자는 자신이 만든 목록만 조회 가능 (created_by가 없는 경우 모든 사용자 허용)
    if (req.session.userRole !== 'admin' && matchList.created_by && matchList.created_by !== req.session.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    
    console.log(`[DEBUG] 경기 목록 조회 성공: ${id} (사용자: ${req.session.username})`);
    res.json(matchList);
  } catch (error) {
    console.error('[DEBUG] 개별 경기 목록 조회 실패:', error);
    res.status(500).json({ error: '경기 목록 조회 중 오류가 발생했습니다.' });
  }
}));

// PUT /api/match-lists/:id - 경기 목록 수정
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, custom_url, matches } = req.body;
    
    console.log(`[DEBUG] 경기 목록 수정 요청: ID=${id}, name=${name}, matches=${JSON.stringify(matches)}`);
    
    const matchList = await MatchList.findByPk(id);
    
    if (!matchList) {
      return res.status(404).json({ error: '경기 목록을 찾을 수 없습니다.' });
    }
    
    // 권한 확인: 일반 사용자는 자신이 만든 목록만 수정 가능 (created_by 필드가 없는 경우 모든 사용자 허용)
    if (req.session.userRole !== 'admin' && matchList.created_by && matchList.created_by !== req.session.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    
    // 경기 목록 정보 업데이트
    const updateData = {};
    if (name) updateData.name = name;
    if (custom_url !== undefined) updateData.custom_url = custom_url;
    if (matches !== undefined) updateData.matches = matches;
    
    await matchList.update(updateData);
    
    console.log(`[DEBUG] 경기 목록 수정 성공: ${id} (사용자: ${req.session.username})`);
    res.json({ success: true, matchList });
  } catch (error) {
    console.error('[DEBUG] 경기 목록 수정 실패:', error);
    res.status(500).json({ error: '경기 목록 수정 중 오류가 발생했습니다.' });
  }
}));

// DELETE /api/match-lists/:id - 경기 목록 삭제
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[DEBUG] 경기 목록 삭제 요청: ID=${id}`);
    
    const matchList = await MatchList.findByPk(id);
    
    if (!matchList) {
      return res.status(404).json({ error: '경기 목록을 찾을 수 없습니다.' });
    }
    
    // 권한 확인: 일반 사용자는 자신이 만든 목록만 삭제 가능 (created_by가 없는 경우 모든 사용자 허용)
    if (req.session.userRole !== 'admin' && matchList.created_by && matchList.created_by !== req.session.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    
    // 경기 목록 삭제
    await matchList.destroy();
    
    console.log(`[DEBUG] 경기 목록 삭제 완료: ${id} (사용자: ${req.session.username})`);
    res.json({ success: true, message: '경기 목록이 삭제되었습니다.' });
  } catch (error) {
    console.error('[DEBUG] 경기 목록 삭제 실패:', error);
    res.status(500).json({ error: '경기 목록 삭제 중 오류가 발생했습니다.' });
  }
}));

// 경기 리스트별 모바일 컨트롤 페이지
router.get('/:id/control-mobile', async (req, res) => {
  try {
    const { id } = req.params;
    const { index = 0 } = req.query;
    const list = await MatchList.findByPk(id);
    
    if (!list) {
      return res.status(404).send('리스트를 찾을 수 없습니다.');
    }
    
    if (!list.matches || list.matches.length === 0) {
      return res.status(404).send('리스트에 등록된 경기가 없습니다.');
    }
    
    const matchIndex = parseInt(index);
    if (matchIndex < 0 || matchIndex >= list.matches.length) {
      return res.status(400).send('잘못된 경기 인덱스입니다.');
    }
    
    const currentMatch = list.matches[matchIndex];
    const match = await Match.findByPk(currentMatch.id);
    
    if (!match) {
      return res.status(404).send('경기를 찾을 수 없습니다.');
    }
    
    console.log(`[DEBUG] 리스트 모바일 컨트롤 렌더링: listId=${id}, matchId=${match.id}, sport_type=${match.sport_type}`);
    
    // sport_type이 없으면 기본값 설정
    const sportType = match.sport_type || 'soccer';
    
    // 템플릿 파일 존재 여부 확인 및 폴백 처리
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.join(__dirname, '..', 'views', `${sportType}-control-mobile.ejs`);
    
    let templateName = `${sportType}-control-mobile`;
    
    // 템플릿 파일이 존재하지 않으면 기본 템플릿 사용
    if (!fs.existsSync(templatePath)) {
      console.log(`[DEBUG] 템플릿 파일이 존재하지 않음: ${templatePath}`);
      console.log(`[DEBUG] 기본 템플릿으로 폴백: soccer-control-mobile`);
      templateName = 'soccer-control-mobile';
    }
    
    res.render(templateName, { 
      match: match,
      listId: id,
      listName: list.name,
      currentMatchIndex: matchIndex,
      totalMatches: list.matches.length
    });
  } catch (error) {
    console.error('리스트 모바일 컨트롤 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 경기 리스트별 오버레이 페이지
router.get('/:id/overlay', async (req, res) => {
  try {
    const { id } = req.params;
    const { index = 0 } = req.query;
    
    console.log(`[DEBUG] 리스트 오버레이 요청: listId=${id}, index=${index}`);
    
    const list = await MatchList.findByPk(id);
    
    if (!list) {
      console.log(`[DEBUG] 리스트를 찾을 수 없음: ${id}`);
      return res.status(404).send('리스트를 찾을 수 없습니다.');
    }
    
    console.log(`[DEBUG] 리스트 찾음: ${list.name}, 경기 수: ${list.matches ? list.matches.length : 0}`);
    
    if (!list.matches || list.matches.length === 0) {
      console.log(`[DEBUG] 리스트에 등록된 경기가 없음`);
      return res.status(404).send('리스트에 등록된 경기가 없습니다.');
    }
    
    // 푸시 정보가 있으면 해당 경기 사용, 없으면 쿼리 파라미터의 인덱스 사용
    let matchIndex = parseInt(index);
    let currentMatch = list.matches[matchIndex];
    
    // 푸시 정보 확인 (전역 변수에서 가져오기)
    const pushedMatches = global.pushedMatches || new Map();
    const pushedMatch = pushedMatches.get(id);
    console.log(`[DEBUG] 푸시 정보 확인: listId=${id}, pushedMatch=`, pushedMatch);
    
    if (pushedMatch && pushedMatch.matchId) {
      // 푸시된 경기가 리스트에 있는지 확인
      const pushedMatchInList = list.matches.find(match => match.id === pushedMatch.matchId);
      console.log(`[DEBUG] 푸시된 경기 리스트에서 찾기: ${pushedMatch.matchId}, found=`, !!pushedMatchInList);
      
      if (pushedMatchInList) {
        currentMatch = pushedMatchInList;
        matchIndex = list.matches.findIndex(match => match.id === pushedMatch.matchId);
        console.log(`[DEBUG] 푸시된 경기 사용: ${pushedMatch.matchId}, 인덱스: ${matchIndex}`);
      } else {
        console.log(`[DEBUG] 푸시된 경기가 리스트에 없음, 쿼리 파라미터 인덱스 사용`);
      }
    } else {
      console.log(`[DEBUG] 푸시 정보 없음, 쿼리 파라미터 인덱스 사용`);
    }
    
    // 인덱스 유효성 검사
    if (matchIndex < 0 || matchIndex >= list.matches.length) {
      console.log(`[DEBUG] 잘못된 경기 인덱스: ${matchIndex}, 총 경기 수: ${list.matches.length}`);
      return res.status(400).send('잘못된 경기 인덱스입니다.');
    }
    
    console.log(`[DEBUG] 최종 선택된 경기 정보:`, currentMatch);
    
    // 데이터베이스에서 실제 경기 정보 가져오기
    const actualMatch = await Match.findByPk(currentMatch.id);
    if (!actualMatch) {
      console.log(`[DEBUG] 데이터베이스에서 경기를 찾을 수 없음: ${currentMatch.id}`);
      return res.status(404).send('경기를 찾을 수 없습니다.');
    }
    
    // 실제 경기 데이터 사용 (최신 정보 포함)
    const matchData = actualMatch.match_data || {};
    const match = {
      id: actualMatch.id,
      sport_type: actualMatch.sport_type || 'soccer',
      home_team: actualMatch.home_team || 'HOME',
      away_team: actualMatch.away_team || 'AWAY',
      home_score: actualMatch.home_score || matchData.home_score || 0,
      away_score: actualMatch.away_score || matchData.away_score || 0,
      home_team_color: actualMatch.home_team_color || '#000000',
      away_team_color: actualMatch.away_team_color || '#FFFFFF',
      home_team_header: actualMatch.home_team_header || actualMatch.home_team || 'HOME',
      away_team_header: actualMatch.away_team_header || actualMatch.away_team || 'AWAY',
      status: actualMatch.status || 'scheduled',
      match_data: matchData
    };
    
    console.log(`[DEBUG] 렌더링할 경기 데이터:`, match);
    
    // 통합 오버레이 템플릿 렌더링
    res.render('unified-overlay', { 
      match: match,
      isListMode: true,
      listId: id,
      listName: list.name,
      currentMatchIndex: matchIndex,
      totalMatches: list.matches.length
    });
  } catch (error) {
    console.error('리스트 오버레이 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 통합 오버레이 페이지 (통합 컨트롤 패널에서 푸시한 경기용)
router.get('/:listId/unified-overlay', async (req, res) => {
  try {
    const { listId } = req.params;
    
    console.log(`[DEBUG] 통합 오버레이 요청: listId=${listId}`);
    
    const list = await MatchList.findByPk(listId);
    
    if (!list) {
      console.log(`[DEBUG] 리스트를 찾을 수 없음: ${listId}`);
      return res.status(404).send('리스트를 찾을 수 없습니다.');
    }
    
    console.log(`[DEBUG] 리스트 찾음: ${list.name}, 경기 수: ${list.matches ? list.matches.length : 0}`);
    
    if (!list.matches || list.matches.length === 0) {
      console.log(`[DEBUG] 리스트에 등록된 경기가 없음`);
      return res.status(404).send('리스트에 등록된 경기가 없습니다.');
    }
    
    // 푸시 정보가 있으면 해당 경기 사용, 없으면 첫 번째 경기 사용
    let currentMatch = list.matches[0];
    let currentMatchIndex = 0;
    
    // 푸시 정보 확인 (전역 변수에서 가져오기)
    const pushedMatches = global.pushedMatches || new Map();
    const pushedMatch = pushedMatches.get(listId);
    console.log(`[DEBUG] 푸시 정보 확인: listId=${listId}, pushedMatch=`, pushedMatch);
    
    if (pushedMatch && pushedMatch.matchId) {
        // 푸시된 경기가 리스트에 있는지 확인
        const pushedMatchInList = list.matches.find(match => match.id === pushedMatch.matchId);
        console.log(`[DEBUG] 푸시된 경기 리스트에서 찾기: ${pushedMatch.matchId}, found=`, !!pushedMatchInList);
        
        if (pushedMatchInList) {
            currentMatch = pushedMatchInList;
            currentMatchIndex = list.matches.findIndex(match => match.id === pushedMatch.matchId);
            console.log(`[DEBUG] 푸시된 경기 사용: ${pushedMatch.matchId}, 인덱스: ${currentMatchIndex}`);
        } else {
            console.log(`[DEBUG] 푸시된 경기가 리스트에 없음, 첫 번째 경기 사용`);
        }
    } else {
        console.log(`[DEBUG] 푸시 정보 없음, 첫 번째 경기 사용`);
    }
    
    console.log(`[DEBUG] 선택된 경기 정보:`, currentMatch);
    
    // 데이터베이스에서 실제 경기 정보 가져오기
    const actualMatch = await Match.findByPk(currentMatch.id);
    if (!actualMatch) {
      console.log(`[DEBUG] 데이터베이스에서 경기를 찾을 수 없음: ${currentMatch.id}`);
      return res.status(404).send('경기를 찾을 수 없습니다.');
    }
    
    // 실제 경기 데이터 사용 (최신 정보 포함)
    const matchData = actualMatch.match_data || {};
    const match = {
      id: actualMatch.id,
      sport_type: actualMatch.sport_type || 'soccer',
      home_team: actualMatch.home_team || 'HOME',
      away_team: actualMatch.away_team || 'AWAY',
      home_score: actualMatch.home_score || matchData.home_score || 0,
      away_score: actualMatch.away_score || matchData.away_score || 0,
      home_team_color: actualMatch.home_team_color || '#000000',
      away_team_color: actualMatch.away_team_color || '#FFFFFF',
      home_team_header: actualMatch.home_team_header || actualMatch.home_team || 'HOME',
      away_team_header: actualMatch.away_team_header || actualMatch.away_team || 'AWAY',
      status: actualMatch.status || 'scheduled',
      match_data: matchData
    };
    
    console.log(`[DEBUG] 렌더링할 경기 데이터:`, match);
    
    // EJS 템플릿에 전달할 변수들 디버깅
    const templateData = { 
      match: match,
      matchId: match.id,
      sport_type: match.sport_type,
      isListMode: true,
      listId: listId,
      listName: list.name,
      currentMatchIndex: currentMatchIndex,
      totalMatches: list.matches.length
    };
    
    console.log(`[DEBUG] EJS 템플릿에 전달할 변수들:`, templateData);
    
    // 캐시 방지 헤더 추가
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // 통합 오버레이 템플릿 렌더링
    res.render('unified-overlay', templateData);
  } catch (error) {
    console.error('통합 오버레이 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

module.exports = router;
