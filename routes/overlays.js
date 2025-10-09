const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// 모델들
const { SportOverlayImage, SportActiveOverlayImage, Match, Sport } = require('../models');

// 오버레이 관련 라우터
// 이 파일은 server.js에서 분리된 오버레이 관련 API들을 포함합니다.

// 중복 API 제거됨 - 아래에 실제 구현이 있음

// ========================================
// Multer 설정
// ========================================

// 종목별 오버레이 이미지 업로드를 위한 multer 설정
const sportOverlayImageUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      // 기본 폴더로 설정 (서버 로직에서 실제 폴더로 이동)
      const dir = path.join(__dirname, '..', 'public', 'overlay-images', 'temp');
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      // 한글 파일명 처리 - Buffer를 사용하여 UTF-8로 디코딩
      let originalName = file.originalname;
      
      // 깨진 파일명인지 확인하고 디코딩 시도
      if (originalName.includes('ì') || originalName.includes('ë') || originalName.includes('í') || 
          originalName.includes('â') || originalName.includes('ê') || originalName.includes('ô')) {
        try {
          // Buffer를 사용하여 UTF-8로 디코딩
          const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
          console.log(`🔧 multer 파일명 디코딩: ${originalName} -> ${decoded}`);
          originalName = decoded;
        } catch (error) {
          console.error('🔧 multer 파일명 디코딩 실패:', error);
        }
      }
      
      console.log(`🔧 multer 파일명 처리: ${originalName}`);
      cb(null, originalName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. JPEG, PNG, GIF, WEBP 파일만 업로드 가능합니다.'));
    }
  }
});

// multer 미들웨어에서 req.body 파싱을 위한 설정
const uploadMiddleware = (req, res, next) => {
  sportOverlayImageUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    // req.body가 제대로 파싱되었는지 확인
    console.log('🔧 uploadMiddleware - req.body:', req.body);
    console.log('🔧 uploadMiddleware - req.file:', req.file);
    next();
  });
};

// ========================================
// 팀 로고 관련 API
// ========================================

// GET /api/overlay-images/team-logo-map/:sportType - 팀 로고 맵 조회 (데이터베이스 전용)
router.get('/team-logo-map/:sportType', asyncHandler(async (req, res) => {
  try {
    const { sportType } = req.params;
    
    console.log(`팀 로고 맵 조회 (데이터베이스 전용): ${sportType}`);
    
    // 데이터베이스 전용 접근 방식 - JSON 파일 의존성 제거
    console.log('데이터베이스 전용 팀 로고 관리 시스템 사용');
    
    res.json({ success: true, logoMap: {} });
  } catch (error) {
    console.error('팀 로고 맵 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}));

// GET /api/overlay-images/soccer-team-logo-visibility/:matchId - 축구 팀 로고 가시성 조회
router.get('/soccer-team-logo-visibility/:matchId', asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`축구 팀 로고 가시성 조회: ${matchId}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const useTeamLogos = match.match_data?.use_team_logos || false;
    res.json({ success: true, useTeamLogos });
  } catch (error) {
    console.error('축구 팀 로고 가시성 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}));

// POST /api/overlay-images/soccer-team-logo-visibility/:matchId - 축구 팀 로고 가시성 설정
router.post('/soccer-team-logo-visibility/:matchId', asyncHandler(async (req, res) => {
  try {
    const { matchId } = req.params;
    const { use_team_logos } = req.body;
    
    console.log(`축구 팀 로고 가시성 설정: ${matchId}, use_team_logos: ${use_team_logos}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const matchData = match.match_data || {};
    matchData.use_team_logos = use_team_logos;
    
    await match.update({ match_data: matchData });
    
    res.json({ 
      success: true, 
      message: '축구 팀 로고 가시성 설정 완료',
      useLogos: use_team_logos 
    });
  } catch (error) {
    console.error('축구 팀 로고 가시성 설정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
}));

// ========================================
// 승부차기 박스 텍스트 관련 API
// ========================================

// GET /api/extra-box-text/:sportType/:matchId - 추가 박스 텍스트 조회
router.get('/extra-box-text/:sportType/:matchId', asyncHandler(async (req, res) => {
  try {
    const { sportType, matchId } = req.params;
    
    // 경기 정보 조회
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: '경기를 찾을 수 없습니다.' });
    }
    
    // match_data에서 extra_box_text 추출
    let extraBoxText = '0 (승부차기) 0'; // 기본값
    if (match.match_data && match.match_data.extra_box_text) {
      extraBoxText = match.match_data.extra_box_text;
    }
    
    console.log(`추가 박스 텍스트 조회: ${sportType} - ${matchId}, text: ${extraBoxText}`);
    
    res.json({ 
      success: true, 
      sportType,
      matchId,
      text: extraBoxText
    });
  } catch (error) {
    console.error('추가 박스 텍스트 조회 실패:', error);
    res.status(500).json({ error: '추가 박스 텍스트 조회에 실패했습니다.' });
  }
}));

// POST /api/extra-box-text - 추가 박스 텍스트 저장
router.post('/extra-box-text', asyncHandler(async (req, res) => {
  try {
    const { sportType, matchId, text } = req.body;
    
    // 경기 정보 조회
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: '경기를 찾을 수 없습니다.' });
    }
    
    // match_data 업데이트
    const matchData = match.match_data || {};
    matchData.extra_box_text = text;
    
    await match.update({ match_data: matchData });
    
    console.log(`추가 박스 텍스트 저장: ${sportType} - ${matchId}, text: ${text}`);
    
    res.json({ 
      success: true, 
      message: '추가 박스 텍스트가 저장되었습니다.',
      sportType,
      matchId,
      text
    });
  } catch (error) {
    console.error('추가 박스 텍스트 저장 실패:', error);
    res.status(500).json({ error: '추가 박스 텍스트 저장에 실패했습니다.' });
  }
}));

// ========================================
// 스포츠 오버레이 디자인 관련 API
// ========================================

// GET /api/sport-overlay-design/:sportCode - 스포츠 오버레이 디자인 조회
router.get('/sport-overlay-design/:sportCode', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    const { Settings } = require('../models');
    
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
    const { Settings } = require('../models');
    
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

// GET /api/sport-overlay-images-with-active/:sportCode - 활성 오버레이 이미지와 함께 조회
router.get('/sport-overlay-images-with-active/:sportCode', asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    console.log(`🔧 종목별 활성 오버레이 이미지 조회: ${sportCode}`);
    
    // 해당 종목의 모든 오버레이 이미지 조회
    const images = await SportOverlayImage.findAll({
      where: { sport_code: sportCode },
      order: [['created_at', 'DESC']]
    });
    
    // 활성 오버레이 이미지 조회
    const activeImage = await SportActiveOverlayImage.findOne({
      where: { sport_code: sportCode }
    });
    
    // 캐시 방지 헤더 추가
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({
      success: true,
      images: images,
      activeImage: activeImage,
      sportCode: sportCode
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 조회에 실패했습니다.' });
  }
}));

// GET /api/sport-active-overlay-image/:sportCode - 활성 오버레이 이미지 조회
router.get('/sport-active-overlay-image/:sportCode', asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    const activeImage = await SportActiveOverlayImage.findOne({
      where: { sport_code: sportCode }
    });
    
    if (activeImage) {
      // 활성 이미지의 상세 정보 조회
      const imageDetail = await SportOverlayImage.findByPk(activeImage.active_image_id);
      
      res.json({
        success: true,
        activeImage: {
          id: activeImage.active_image_id,
          path: activeImage.active_image_path,
          filename: imageDetail ? imageDetail.filename : 'Unknown',
          sportCode: sportCode
        }
      });
    } else {
      res.json({
        success: true,
        activeImage: null
      });
    }
  } catch (error) {
    console.error('활성 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 조회에 실패했습니다.' });
  }
}));

// POST /api/sport-overlay-image/:sportCode - 스포츠 오버레이 이미지 업로드
router.post('/sport-overlay-image/:sportCode', requireAuth, uploadMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔧 업로드 요청 body:', req.body);
    console.log('🔧 업로드 요청 file:', req.file);
    console.log('🔧 FormData fields:', Object.keys(req.body));
    console.log('🔧 req.body.sportCode:', req.body.sportCode);
    console.log('🔧 req.body 전체 내용:', JSON.stringify(req.body, null, 2));
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    }

    const { sportCode } = req.params;
    console.log('🔧 URL 파라미터에서 추출된 sportCode:', sportCode);
    console.log('🔧 sportCode 타입:', typeof sportCode);
    
    if (!sportCode) {
      return res.status(400).json({ success: false, message: '종목 코드가 필요합니다.' });
    }

    // 언더바가 포함된 파일명 체크
    if (req.file.filename.includes('_')) {
      return res.status(400).json({ 
        success: false, 
        message: '파일명에 언더바(_)가 포함된 파일은 업로드할 수 없습니다. 파일명을 변경한 후 다시 시도해주세요.' 
      });
    }

    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }

    // 종목명을 대문자로 변환하여 폴더명으로 사용
    const sportFolderName = sport.name.toUpperCase();
    const sportFolderPath = path.join(__dirname, '..', 'public', 'overlay-images', sportFolderName);
    if (!fsSync.existsSync(sportFolderPath)) {
      fsSync.mkdirSync(sportFolderPath, { recursive: true });
      console.log(`🔧 종목별 폴더 생성: ${sportFolderPath}`);
    }

    // 파일을 temp 폴더에서 종목별 폴더로 이동
    const tempFilePath = req.file.path; // multer가 저장한 임시 파일 경로
    const finalFilePath = path.join(sportFolderPath, req.file.filename);
    
    try {
      // 파일 이동
      fsSync.renameSync(tempFilePath, finalFilePath);
      console.log(`🔧 파일 이동 완료: ${tempFilePath} -> ${finalFilePath}`);
    } catch (error) {
      console.error('🔧 파일 이동 실패:', error);
      return res.status(500).json({ success: false, message: '파일 저장에 실패했습니다.' });
    }

    // 이미지 파일 경로 생성 (public 폴더 기준 상대 경로)
    const imagePath = `/overlay-images/${sportCode}/${req.file.filename}`;
    
    // 중복 파일명 확인
    const existingImage = await SportOverlayImage.findOne({
      where: { 
        sport_code: sportCode,
        filename: req.file.filename
      }
    });
    
    if (existingImage) {
      // 중복 파일이 있는 경우, 사용 중인지 확인
      const isActive = existingImage.is_active;
      
      if (isActive) {
        // 사용 중인 파일이면 오버레이에서 해제
        await existingImage.update({ is_active: false });
        
        // WebSocket으로 오버레이에서 제거 알림
        const io = require('../server_refactored_new').io;
        if (io) {
          io.emit('sport_overlay_image_updated', { 
            action: 'status_changed',
            sportCode: sportCode,
            filename: req.file.filename,
            isActive: false
          });
        }
      }
      
      // 기존 파일 삭제 (물리적 파일)
      const existingFilePath = path.join(__dirname, '..', 'public', 'overlay-images', sportCode, req.file.filename);
      if (fsSync.existsSync(existingFilePath)) {
        fsSync.unlinkSync(existingFilePath);
      }
      
      // 기존 데이터베이스 레코드 삭제
      await existingImage.destroy();
    }
    
    // 새로운 이미지 데이터베이스에 저장
    await SportOverlayImage.create({
      sport_code: sportCode,
      filename: req.file.filename,
      file_path: imagePath,
      is_active: true
    });
    
    console.log(`종목별 오버레이 이미지 업로드: ${sportCode} - ${req.file.filename}`);
    
    // 실시간 업데이트를 위한 WebSocket 이벤트 발송
    const io = require('../server_refactored_new').io;
    if (io) {
      io.emit('sport_overlay_image_updated', { 
        action: 'uploaded',
        sportCode: sportCode,
        imagePath: imagePath,
        filename: req.file.filename
      });
    }
    
    res.json({ 
      success: true, 
      imagePath: imagePath,
      filename: req.file.filename,
      sportCode: sportCode,
      message: '종목별 오버레이 이미지가 성공적으로 업로드되었습니다.'
    });
  } catch (error) {
    console.error('스포츠 오버레이 이미지 업로드 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}));

// GET /api/sport-overlay-image/:sportCode/:filename - 스포츠 오버레이 이미지 조회
router.get('/sport-overlay-image/:sportCode/:filename', asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    res.json({ success: true, message: '스포츠 오버레이 이미지 조회', sportCode, filename });
  } catch (error) {
    console.error('스포츠 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '스포츠 오버레이 이미지 조회에 실패했습니다.' });
  }
}));

// GET /api/sport-overlay-image/:sportCode/:filename/status - 스포츠 오버레이 이미지 상태 조회
router.get('/sport-overlay-image/:sportCode/:filename/status', asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    const image = await SportOverlayImage.findOne({
      where: { 
        sport_code: sportCode,
        filename: filename
      }
    });
    
    if (!image) {
      // 파일이 존재하지 않는 경우 - 중복 없음
      return res.json({ 
        success: true, 
        isActive: false,
        sportCode: sportCode,
        filename: filename,
        exists: false
      });
    }
    
    res.json({ 
      success: true, 
      isActive: image.is_active,
      sportCode: sportCode,
      filename: filename,
      exists: true
    });
  } catch (error) {
    console.error('스포츠 오버레이 이미지 상태 조회 실패:', error);
    res.status(500).json({ error: '스포츠 오버레이 이미지 상태 조회에 실패했습니다.' });
  }
}));

// PUT /api/sport-overlay-image/:sportCode/:filename/status - 스포츠 오버레이 이미지 상태 변경
router.put('/sport-overlay-image/:sportCode/:filename/status', asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    const { isActive } = req.body;
    
    const image = await SportOverlayImage.findOne({
      where: { 
        sport_code: sportCode,
        filename: filename
      }
    });
    
    if (!image) {
      return res.status(404).json({ success: false, message: '이미지를 찾을 수 없습니다.' });
    }
    
    await image.update({ is_active: isActive });
    
    // WebSocket 이벤트 발송
    const io = require('../server_refactored_new').io;
    if (io) {
      io.emit('sport_overlay_image_updated', { 
        action: 'status_changed',
        sportCode: sportCode,
        filename: filename,
        isActive: isActive
      });
    }
    
    res.json({
      success: true,
      message: `이미지 상태가 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
      sportCode: sportCode,
      filename: filename,
      isActive: isActive
    });
  } catch (error) {
    console.error('스포츠 오버레이 이미지 상태 변경 실패:', error);
    res.status(500).json({ error: '스포츠 오버레이 이미지 상태 변경에 실패했습니다.' });
  }
}));

// POST /api/sport-active-overlay-image/:sportCode - 활성 오버레이 이미지 설정 (POST 메서드 추가)
router.post('/sport-active-overlay-image/:sportCode', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    const { imageId } = req.body;
    
    if (!imageId) {
      return res.status(400).json({ success: false, message: '이미지 ID가 필요합니다.' });
    }
    
    // 이미지가 존재하는지 확인
    const image = await SportOverlayImage.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: '이미지를 찾을 수 없습니다.' });
    }
    
    // 기존 활성 이미지 삭제
    await SportActiveOverlayImage.destroy({
      where: { sport_code: sportCode }
    });
    
    // 새로운 활성 이미지 설정
    await SportActiveOverlayImage.create({
      sport_code: sportCode,
      active_image_id: imageId,
      active_image_path: image.file_path
    });
    
    // 실시간 업데이트를 위한 WebSocket 이벤트 발송
    const io = require('../server_refactored_new').io;
    if (io) {
      io.emit('sport_overlay_image_updated', { 
        action: 'activated',
        sportCode: sportCode,
        imageId: imageId,
        imagePath: image.file_path
      });
    }
    
    res.json({
      success: true,
      message: '활성 오버레이 이미지가 설정되었습니다.',
      sportCode: sportCode,
      imageId: imageId
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 설정 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 설정에 실패했습니다.' });
  }
}));

// PUT /api/sport-active-overlay-image/:sportCode - 활성 오버레이 이미지 설정
router.put('/sport-active-overlay-image/:sportCode', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    const { imageId } = req.body;
    
    if (!imageId) {
      return res.status(400).json({ success: false, message: '이미지 ID가 필요합니다.' });
    }
    
    // 이미지가 존재하는지 확인
    const image = await SportOverlayImage.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: '이미지를 찾을 수 없습니다.' });
    }
    
    // 기존 활성 이미지 삭제
    await SportActiveOverlayImage.destroy({
      where: { sport_code: sportCode }
    });
    
    // 새로운 활성 이미지 설정
    await SportActiveOverlayImage.create({
      sport_code: sportCode,
      active_image_id: imageId,
      active_image_path: image.file_path
    });
    
    res.json({
      success: true,
      message: '활성 오버레이 이미지가 설정되었습니다.',
      sportCode: sportCode,
      imageId: imageId
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 설정 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 설정에 실패했습니다.' });
  }
}));

// DELETE /api/sport-overlay-image/:sportCode/:filename - 스포츠 오버레이 이미지 삭제
router.delete('/sport-overlay-image/:sportCode/:filename', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 데이터베이스에서 이미지 정보 조회
    const imageRecord = await SportOverlayImage.findOne({
      where: { sport_code: sportCode, filename: filename }
    });
    
    if (!imageRecord) {
      return res.status(404).json({ success: false, message: '이미지를 찾을 수 없습니다.' });
    }
    
    // 파일 삭제
    const filePath = path.join(__dirname, '..', 'public', 'overlay-images', sportCode, filename);
    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
    }
    
    // 데이터베이스에서 삭제
    await imageRecord.destroy();
    
    console.log(`종목별 오버레이 이미지 삭제: ${sportCode} - ${filename}`);
    
    // 실시간 업데이트를 위한 WebSocket 이벤트 발송
    const io = require('../server_refactored_new').io;
    if (io) {
      io.emit('sport_overlay_image_updated', { 
        action: 'deleted',
        sportCode: sportCode,
        filename: filename
      });
    }
    
    res.json({ 
      success: true, 
      message: '종목별 오버레이 이미지가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('스포츠 오버레이 이미지 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}));

// DELETE /api/sport-active-overlay-image/:sportCode - 활성 오버레이 이미지 삭제
router.delete('/sport-active-overlay-image/:sportCode', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    await SportActiveOverlayImage.destroy({
      where: { sport_code: sportCode }
    });
    
    res.json({
      success: true,
      message: '활성 오버레이 이미지가 삭제되었습니다.',
      sportCode: sportCode
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 삭제 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 삭제에 실패했습니다.' });
  }
}));

// GET /api/overlay-images/:sportCode - 스포츠별 오버레이 이미지 조회
router.get('/:sportCode', asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    const images = await SportOverlayImage.findAll({
      where: { sport_code: sportCode },
      order: [['created_at', 'DESC']]
    });
    
    res.json(images);
  } catch (error) {
    console.error('오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '오버레이 이미지 조회에 실패했습니다.' });
  }
}));

// POST /api/overlay-images - 오버레이 이미지 업로드
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    // 파일 업로드 로직 (multer 사용)
    res.json({ message: '오버레이 이미지 업로드 API - 리팩토링 중' });
  } catch (error) {
    console.error('오버레이 이미지 업로드 실패:', error);
    res.status(500).json({ error: '오버레이 이미지 업로드에 실패했습니다.' });
  }
}));

// DELETE /api/overlay-images/:sportCode/:filename - 오버레이 이미지 삭제
// 이 라우트는 더 이상 사용하지 않음 - 대신 /sport-overlay-image/:sportCode/:filename 사용
// router.delete('/:sportCode/:filename', requireAuth, asyncHandler(async (req, res) => {
//   try {
//     const { sportCode, filename } = req.params;
//     
//     const image = await SportOverlayImage.findOne({
//       where: { 
//         sport_code: sportCode,
//         filename: filename
//       }
//     });
//     
//     if (!image) {
//       return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
//     }
//     
//     await image.destroy();
//     
//     console.log(`오버레이 이미지 삭제: ${filename}`);
//     res.json({ success: true });
//   } catch (error) {
//     console.error('오버레이 이미지 삭제 실패:', error);
//     res.status(500).json({ error: '오버레이 이미지 삭제에 실패했습니다.' });
//   }
// }));

// PUT /api/overlay-images/:sportCode/:filename/status - 오버레이 이미지 상태 변경
// 이 라우트는 더 이상 사용하지 않음 - 대신 /sport-overlay-image/:sportCode/:filename/status 사용
// router.put('/:sportCode/:filename/status', requireAuth, asyncHandler(async (req, res) => {
//   try {
//     const { sportCode, filename } = req.params;
//     const { is_active } = req.body;
//     
//     const image = await SportOverlayImage.findOne({
//       where: { 
//         sport_code: sportCode,
//         filename: filename
//       }
//     });
//     
//     if (!image) {
//       return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
//     }
//     
//     await image.update({ is_active });
//     
//     console.log(`오버레이 이미지 상태 변경: ${filename} -> ${is_active}`);
//     res.json({ success: true, image });
//   } catch (error) {
//     console.error('오버레이 이미지 상태 변경 실패:', error);
//     res.status(500).json({ error: '오버레이 이미지 상태 변경에 실패했습니다.' });
//   }
// }));

// POST /api/overlay-images/update-team-logo-map - 팀 로고 맵 업데이트 (데이터베이스 전용)
router.post('/update-team-logo-map', async (req, res) => {
  try {
    const { sportType, teamLogoMap } = req.body;
    
    console.log(`팀 로고 맵 업데이트 (데이터베이스 전용): ${sportType}`);
    
    // 데이터베이스 전용 접근 방식 - JSON 파일 의존성 제거
    console.log('데이터베이스 전용 팀 로고 관리 시스템 사용');
    
    res.json({ success: true, message: '데이터베이스 전용 팀 로고 관리 시스템 사용' });
  } catch (error) {
    console.error('팀 로고 맵 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/overlay-images/soccer-team-logo-visibility - 축구 팀 로고 가시성 저장
router.post('/soccer-team-logo-visibility', async (req, res) => {
  try {
    const { matchId, useLogos } = req.body;
    
    console.log(`축구 팀 로고 가시성 저장: ${matchId}, useLogos: ${useLogos}`);
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const matchData = match.match_data || {};
    matchData.use_team_logos = useLogos;
    
    await match.update({ match_data: matchData });
    
    console.log(`축구 팀 로고 가시성 저장 완료: ${matchId}`);
    res.json({ success: true, message: '팀 로고 가시성이 저장되었습니다.' });
  } catch (error) {
    console.error('축구 팀 로고 가시성 저장 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 팀 로고 업로드를 위한 multer 설정

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// 🚨 기존 팀로고 API 제거됨 - routes/overlay-images.js로 이동
// POST /api/overlay-images/team-logo - 팀 로고 업로드 (중복 제거)

// 🚨 중복 라우트 제거됨 - 위에서 이미 정의됨
// POST /api/overlay-images/update-team-logo-map - 팀 로고 매핑 업데이트 (중복 제거됨)
/*
router.post('/update-team-logo-map', async (req, res) => {
  try {
    const { sportType, teamLogoMap, teamName, logoPath, logoName, bgColor } = req.body;
    
    console.log(`팀 로고 매핑 업데이트 (데이터베이스 전용): ${sportType}`);
    
    // 데이터베이스 전용 접근 방식 - JSON 파일 의존성 제거
    console.log('데이터베이스 전용 팀 로고 관리 시스템 사용');
    
    res.json({
      success: true,
      message: '데이터베이스 전용 팀 로고 관리 시스템 사용'
    });
  } catch (error) {
    console.error('팀 로고 매핑 업데이트 중 오류 발생:', error);
    res.status(500).json({
      error: '팀 로고 매핑 업데이트 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});
*/

module.exports = router;
