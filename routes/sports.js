const express = require('express');
const router = express.Router();
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { Sport, UserSportPermission, User, Match, SportOverlayImage, SportActiveOverlayImage } = require('../models');

// 스포츠 관련 라우터
// 이 파일은 server.js에서 분리된 스포츠 관련 API들을 포함합니다.

// GET /api/sport - 모든 스포츠 조회
router.get('/', asyncHandler(async (req, res) => {
  try {
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default'],
      order: [['id', 'ASC']]
    });
    res.json(sports);
  } catch (error) {
    console.error('스포츠 조회 실패:', error);
    res.status(500).json({ error: '스포츠 조회에 실패했습니다.' });
  }
}));

// POST /api/sport - 새 스포츠 생성
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { name, code, template, description } = req.body;
    
    if (!name || !code || !template) {
      return res.status(400).json({ error: '종목명, 종목 코드, 템플릿은 필수입니다.' });
    }

    // 템플릿 존재 확인 (기본 템플릿 또는 DB 템플릿)
    const { Template } = require('../models');
    const fs = require('fs');
    const path = require('path');
    
    // 기본 템플릿 확인 (soccer, baseball)
    const isBaseTemplate = template === 'soccer' || template === 'baseball';
    let templateExists = false;
    
    if (isBaseTemplate) {
      // 기본 템플릿 파일 존재 확인
      const templateFile = path.join(__dirname, '../views', `${template}-template.ejs`);
      templateExists = fs.existsSync(templateFile);
    } else {
      // DB 템플릿 확인
      const existingTemplate = await Template.findOne({ where: { name: template } });
      templateExists = !!existingTemplate;
    }
    
    if (!templateExists) {
      return res.status(400).json({ error: '존재하지 않는 템플릿입니다.' });
    }

    // 코드 중복 확인
    const existingSport = await Sport.findOne({ where: { code } });
    if (existingSport) {
      return res.status(400).json({ error: '이미 존재하는 종목 코드입니다.' });
    }

    const sport = await Sport.create({
      name,
      code,
      template,
      description,
      is_active: true,
      is_default: false
    });

    // 종목별 오버레이 이미지 폴더 생성 (종목코드 대문자로)
    const fsPromises = require('fs').promises;
    const sportFolderName = code.toUpperCase();
    const sportFolderPath = path.join(__dirname, '../public/overlay-images', sportFolderName);
    
    try {
      await fsPromises.access(sportFolderPath);
      console.log(`✅ 폴더 이미 존재: ${sportFolderPath}`);
    } catch (error) {
      console.log(`🔧 폴더 생성 중: ${sportFolderPath}`);
      await fsPromises.mkdir(sportFolderPath, { recursive: true });
      console.log(`✅ 폴더 생성 완료: ${sportFolderPath}`);
    }

    console.log(`새 종목 생성: ${name} (${code}) by user ${req.session.username}`);
    console.log(`🔧 오버레이 이미지 폴더 생성: ${sportFolderPath}`);
    res.json(sport);
  } catch (error) {
    console.error('종목 생성 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}));

// PUT /api/sport/:code - 스포츠 수정
router.put('/:code', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;
    const { name, template, description } = req.body;
    
    const sport = await Sport.findOne({ where: { code } });
    if (!sport) {
      return res.status(404).json({ error: '스포츠를 찾을 수 없습니다.' });
    }

    await sport.update({
      name,
      template,
      description
    });

    console.log(`스포츠 수정: ${sport.name} (${code})`);
    res.json({ success: true, sport });
  } catch (error) {
    console.error('스포츠 수정 실패:', error);
    res.status(500).json({ error: '스포츠 수정에 실패했습니다.' });
  }
}));

// DELETE /api/sport/:code - 스포츠 삭제
router.delete('/:code', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;
    
    const sport = await Sport.findOne({ where: { code } });
    if (!sport) {
      return res.status(404).json({ error: '스포츠를 찾을 수 없습니다.' });
    }

    // 관련 데이터 먼저 삭제
    console.log(`🔧 종목 삭제 시작: ${sport.name} (${code})`);
    
    // 1. 활성 오버레이 이미지 삭제 (강제 삭제)
    try {
      const activeImages = await SportActiveOverlayImage.findAll({ where: { sport_code: code } });
      console.log(`🔍 활성 오버레이 이미지 ${activeImages.length}개 발견`);
      
      for (const activeImage of activeImages) {
        await activeImage.destroy({ force: true });
        console.log(`✅ 활성 오버레이 이미지 삭제: ${activeImage.id}`);
      }
      console.log(`✅ 활성 오버레이 이미지 삭제 완료: ${code}`);
    } catch (error) {
      console.log(`⚠️ 활성 오버레이 이미지 삭제 실패: ${error.message}`);
    }
    
    // 2. 오버레이 이미지 삭제 (강제 삭제)
    try {
      const overlayImages = await SportOverlayImage.findAll({ where: { sport_code: code } });
      console.log(`🔍 오버레이 이미지 ${overlayImages.length}개 발견`);
      
      for (const overlayImage of overlayImages) {
        await overlayImage.destroy({ force: true });
        console.log(`✅ 오버레이 이미지 삭제: ${overlayImage.filename}`);
      }
      console.log(`✅ 오버레이 이미지 삭제 완료: ${code}`);
    } catch (error) {
      console.log(`⚠️ 오버레이 이미지 삭제 실패: ${error.message}`);
    }
    
    // 3. 관련 경기 삭제 (선택사항 - 필요에 따라 주석 처리)
    try {
      const matchCount = await Match.count({ where: { sport_type: code.toLowerCase() } });
      if (matchCount > 0) {
        console.log(`⚠️ 관련 경기 ${matchCount}개가 있습니다. 경기를 먼저 삭제해주세요.`);
        return res.status(400).json({ error: `관련 경기 ${matchCount}개가 있어 삭제할 수 없습니다.` });
      }
    } catch (error) {
      console.log(`⚠️ 경기 확인 실패: ${error.message}`);
    }

    // 4. 종목별 오버레이 이미지 폴더 삭제 (종목코드 대문자로)
    const fsPromises = require('fs').promises;
    const sportFolderName = sport.code.toUpperCase();
    const sportFolderPath = path.join(__dirname, '../public/overlay-images', sportFolderName);
    
    try {
      await fsPromises.access(sportFolderPath);
      console.log(`🔧 폴더 삭제 중: ${sportFolderPath}`);
      await fsPromises.rm(sportFolderPath, { recursive: true });
      console.log(`✅ 폴더 삭제 완료: ${sportFolderPath}`);
    } catch (error) {
      console.log(`⚠️ 폴더가 존재하지 않거나 삭제 실패: ${error.message}`);
    }

    // 5. 마지막으로 종목 삭제
    await sport.destroy();

    console.log(`스포츠 삭제: ${sport.name} (${code})`);
    res.json({ success: true });
  } catch (error) {
    console.error('스포츠 삭제 실패:', error);
    res.status(500).json({ error: '스포츠 삭제에 실패했습니다.' });
  }
}));

// GET /api/sport/:sportId/permissions - 종목별 사용자 권한 조회
router.get('/:sportId/permissions', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportId } = req.params;
    
    const permissions = await UserSportPermission.findAll({
      where: { sport_id: sportId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'full_name']
      }]
    });
    
    res.json(permissions);
  } catch (error) {
    console.error('종목 권한 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}));

// POST /api/sport/:sportId/permissions - 종목별 사용자 권한 저장
router.post('/:sportId/permissions', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportId } = req.params;
    const { userIds } = req.body;
    
    // 기존 권한 삭제
    await UserSportPermission.destroy({
      where: { sport_id: sportId }
    });
    
    // 새 권한 생성
    if (userIds && userIds.length > 0) {
      const permissions = userIds.map(userId => ({
        sport_id: sportId,
        user_id: userId
      }));
      
      await UserSportPermission.bulkCreate(permissions);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('종목 권한 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}));

module.exports = router;
