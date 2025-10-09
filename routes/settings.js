const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { Settings, Sport } = require('../models');

// 설정 관련 라우터
// 이 파일은 server.js에서 분리된 설정 관련 API들을 포함합니다.

// ========================================
// 기본 설정 관련 API
// ========================================

// GET /api/settings - 설정 조회
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const settings = await Settings.findAll({
      order: [['created_at', 'DESC']]
    });
    
    res.json(settings);
  } catch (error) {
    console.error('설정 조회 실패:', error);
    res.status(500).json({ error: '설정 조회에 실패했습니다.' });
  }
}));

// POST /api/settings - 설정 저장
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: '키와 값은 필수입니다.' });
    }
    
    const setting = await Settings.upsert({
      key,
      value,
      description: description || null
    });
    
    res.json({ success: true, setting });
  } catch (error) {
    console.error('설정 저장 실패:', error);
    res.status(500).json({ error: '설정 저장에 실패했습니다.' });
  }
}));

// ========================================
// 스포츠 관련 설정 API
// ========================================

// GET /api/sport - 스포츠 목록 조회
router.get('/sport', requireAuth, asyncHandler(async (req, res) => {
  try {
    const sports = await Sport.findAll({
      where: { is_active: true },
      order: [['id', 'ASC']]
    });
    
    res.json(sports);
  } catch (error) {
    console.error('스포츠 목록 조회 실패:', error);
    res.status(500).json({ error: '스포츠 목록 조회에 실패했습니다.' });
  }
}));

// ========================================
// 축구 경기 상태 가시성 관련 API
// ========================================

// GET /api/soccer-match-state-visibility - 축구 경기 상태 가시성 조회
router.get('/soccer-match-state-visibility', requireAuth, asyncHandler(async (req, res) => {
  try {
    const setting = await Settings.findOne({
      where: { key: 'soccer_match_state_visibility' }
    });
    
    const visibility = setting ? setting.value === 'true' : false;
    
    res.json({ success: true, visibility });
  } catch (error) {
    console.error('축구 경기 상태 가시성 조회 실패:', error);
    res.status(500).json({ error: '축구 경기 상태 가시성 조회에 실패했습니다.' });
  }
}));

// POST /api/soccer-match-state-visibility - 축구 경기 상태 가시성 설정
router.post('/soccer-match-state-visibility', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { visibility } = req.body;
    
    await Settings.upsert({
      key: 'soccer_match_state_visibility',
      value: visibility ? 'true' : 'false',
      description: '축구 경기 상태 가시성 설정'
    });
    
    res.json({ success: true, visibility });
  } catch (error) {
    console.error('축구 경기 상태 가시성 설정 실패:', error);
    res.status(500).json({ error: '축구 경기 상태 가시성 설정에 실패했습니다.' });
  }
}));

// ========================================
// 오버레이 디자인 관련 API
// ========================================

// GET /api/sport-overlay-design/:sportCode - 스포츠 오버레이 디자인 조회
router.get('/sport-overlay-design/:sportCode', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    const setting = await Settings.findOne({
      where: { key: `sport_overlay_design_${sportCode}` }
    });
    
    const design = setting ? JSON.parse(setting.value) : {};
    
    res.json({ success: true, design });
  } catch (error) {
    console.error('스포츠 오버레이 디자인 조회 실패:', error);
    res.status(500).json({ error: '스포츠 오버레이 디자인 조회에 실패했습니다.' });
  }
}));

// POST /api/sport-overlay-design/:sportCode - 스포츠 오버레이 디자인 저장
router.post('/sport-overlay-design/:sportCode', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    const design = req.body;
    
    await Settings.upsert({
      key: `sport_overlay_design_${sportCode}`,
      value: JSON.stringify(design),
      description: `${sportCode} 스포츠 오버레이 디자인 설정`
    });
    
    res.json({ success: true, design });
  } catch (error) {
    console.error('스포츠 오버레이 디자인 저장 실패:', error);
    res.status(500).json({ error: '스포츠 오버레이 디자인 저장에 실패했습니다.' });
  }
}));

// POST /api/soccer-overlay-design/reset - 축구 오버레이 디자인 리셋
router.post('/soccer-overlay-design/reset', requireAuth, asyncHandler(async (req, res) => {
  try {
    await Settings.destroy({
      where: { key: 'sport_overlay_design_SOCCER' }
    });
    
    res.json({ success: true, message: '축구 오버레이 디자인이 리셋되었습니다.' });
  } catch (error) {
    console.error('축구 오버레이 디자인 리셋 실패:', error);
    res.status(500).json({ error: '축구 오버레이 디자인 리셋에 실패했습니다.' });
  }
}));

module.exports = router;
