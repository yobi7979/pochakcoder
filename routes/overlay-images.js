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

// WebSocket 이벤트 전송을 위한 함수 (Room 기반)
const emitOverlayImageUpdate = (sportCode, isActive, imageData = null) => {
  const io = require('../server_refactored_new').getIO();
  if (io) {
    // Room에 참여한 클라이언트 수 확인
    const room = io.sockets.adapter.rooms.get(`sport_${sportCode}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`🔧 오버레이 이미지 상태 변경 WebSocket 이벤트 전송: ${sportCode}, 활성화: ${isActive}`);
    console.log(`🔧 Room 참여 클라이언트 수: ${clientCount}`);
    
    if (clientCount > 0) {
      // 해당 종목의 Room에만 전송
      io.to(`sport_${sportCode}`).emit('overlay_image_status_changed', {
        sportCode: sportCode,
        isActive: isActive,
        imageData: imageData,
        timestamp: new Date().toISOString()
      });
      
      // 오버레이 페이지 새로고침 신호 전송
      io.to(`sport_${sportCode}`).emit('overlay_page_refresh', {
        sportCode: sportCode,
        reason: 'overlay_image_status_changed',
        timestamp: new Date().toISOString()
      });
      
      console.log(`🔧 WebSocket Room 전송: sport_${sportCode}`);
      console.log(`🔧 오버레이 페이지 새로고침 신호 전송: sport_${sportCode}`);
    } else {
      console.log(`⚠️ Room에 참여한 클라이언트가 없음: sport_${sportCode}`);
      console.log(`🔧 강제 새로고침 신호를 모든 클라이언트에 전송`);
      
      // Room에 참여한 클라이언트가 없으면 모든 클라이언트에 새로고침 신호 전송
      io.emit('overlay_page_refresh', {
        sportCode: sportCode,
        reason: 'force_refresh_no_room_participants',
        timestamp: new Date().toISOString()
      });
    }
  }
};

// 오버레이 이미지 전용 독립 라우터
// 이 파일은 오버레이 이미지 관련 기능만을 위한 완전 독립적인 라우터입니다.

// ========================================
// Multer 설정
// ========================================

// 오버레이 이미지 업로드를 위한 multer 설정
const overlayImageUpload = multer({
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        const sportCode = req.params.sportCode;
        
        // 종목 정보 조회하여 종목명 가져오기
        const sport = await Sport.findOne({ where: { code: sportCode } });
        if (!sport) {
          return cb(new Error('존재하지 않는 종목입니다.'), null);
        }
        
        // 종목코드를 대문자로 변환하여 폴더명으로 사용
        const sportFolderName = sport.code.toUpperCase();
        const dir = path.join(__dirname, '..', 'public', 'overlay-images', sportFolderName);
        
        // 종목별 폴더가 없으면 생성
        if (!fsSync.existsSync(dir)) {
          fsSync.mkdirSync(dir, { recursive: true });
          console.log(`🔧 종목별 폴더 생성: ${dir}`);
        }
        
        cb(null, dir);
      } catch (error) {
        console.error('🔧 multer destination 오류:', error);
        cb(error, null);
      }
    },
    filename: function (req, file, cb) {
      // 한글 파일명 처리 - Buffer를 사용하여 UTF-8로 디코딩
      let originalName = file.originalname;
      
      // 깨진 파일명인지 확인하고 디코딩 시도
      if (originalName.includes('ì') || originalName.includes('ë') || originalName.includes('í')) {
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
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: function (req, file, cb) {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

// ========================================
// 오버레이 이미지 업로드 API
// ========================================

// POST /api/overlay-images/upload/:sportCode - 오버레이 이미지 업로드
router.post('/upload/:sportCode', requireAuth, overlayImageUpload.single('image'), asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    const file = req.file;
    
    console.log(`🔧 오버레이 이미지 업로드 요청: ${sportCode}`);
    console.log(`🔧 업로드 파일: ${file.originalname}`);
    
    if (!file) {
      return res.status(400).json({ 
        success: false, 
        message: '이미지 파일이 필요합니다.' 
      });
    }
    
    // 종목 존재 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ 
        success: false, 
        message: '존재하지 않는 종목입니다.' 
      });
    }
    
    // 기존 이미지가 활성화되어 있으면 비활성화
    const existingActive = await SportActiveOverlayImage.findOne({ 
      where: { sport_code: sportCode } 
    });
    
    if (existingActive) {
      await existingActive.destroy();
      console.log(`🔧 기존 활성 이미지 비활성화: ${existingActive.filename}`);
    }
    
    // 종목코드를 대문자로 변환하여 폴더명으로 사용
    const sportFolderName = sport.code.toUpperCase();
    
    // 새 이미지 레코드 생성
    const imageRecord = await SportOverlayImage.create({
      sport_code: sportCode,
      filename: file.originalname,
      file_path: `/overlay-images/${sportFolderName}/${file.originalname}`,
      is_active: true,
      upload_time: new Date()
    });
    
    // 활성 이미지로 설정
    await SportActiveOverlayImage.create({
      sport_code: sportCode,
      image_id: imageRecord.id,
      filename: file.originalname,
      file_path: `/overlay-images/${sportFolderName}/${file.originalname}`,
      activated_at: new Date()
    });
    
    console.log(`✅ 오버레이 이미지 업로드 완료: ${file.originalname}`);
    
    res.json({
      success: true,
      message: '오버레이 이미지가 성공적으로 업로드되었습니다.',
      image: {
        id: imageRecord.id,
        filename: file.originalname,
        file_path: `/overlay-images/${sportCode}/${file.originalname}`,
        is_active: true
      }
    });
    
  } catch (error) {
    console.error('오버레이 이미지 업로드 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '이미지 업로드에 실패했습니다.',
      error: error.message 
    });
  }
}));

// ========================================
// 오버레이 이미지 목록 조회 API
// ========================================

// GET /api/overlay-images/list/:sportCode - 종목별 오버레이 이미지 목록 조회
router.get('/list/:sportCode', asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    console.log(`🔧 오버레이 이미지 목록 조회: ${sportCode}`);
    
    // 종목 정보 조회하여 종목코드 가져오기
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ 
        success: false, 
        message: '존재하지 않는 종목입니다.' 
      });
    }
    
    const sportFolderName = sport.code.toUpperCase();
    
    // 해당 종목의 모든 오버레이 이미지 조회
    const images = await SportOverlayImage.findAll({
      where: { sport_code: sportCode },
      order: [['created_at', 'DESC']]
    });
    
    // 활성 이미지 조회
    const activeImage = await SportActiveOverlayImage.findOne({
      where: { sport_code: sportCode }
    });
    
    // 한글 파일명 처리
    const processedImages = images.map(image => {
      let filename = image.filename;
      let filePath = image.file_path;
      
      // 깨진 파일명인지 확인하고 디코딩
      if (filename.includes('ì') || filename.includes('ë') || filename.includes('í') || 
          filename.includes('â') || filename.includes('ê') || filename.includes('ô')) {
        try {
          const decodedFilename = Buffer.from(filename, 'latin1').toString('utf8');
          filename = decodedFilename;
          filePath = `/overlay-images/${sportFolderName}/${decodedFilename}`;
          
          // 데이터베이스도 업데이트
          image.update({
            filename: decodedFilename,
            file_path: filePath
          });
        } catch (error) {
          console.error('파일명 디코딩 실패:', error);
        }
      }
      
      return {
        ...image.toJSON(),
        filename: filename,
        file_path: filePath
      };
    });
    
    res.json({
      success: true,
      sportCode: sportCode,
      images: processedImages,
      activeImage: activeImage
    });
    
  } catch (error) {
    console.error('오버레이 이미지 목록 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '이미지 목록 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

// ========================================
// 활성 오버레이 이미지 조회 API
// ========================================

// GET /api/overlay-images/active/:sportCode - 활성 오버레이 이미지 조회
router.get('/active/:sportCode', asyncHandler(async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    console.log(`🔧 활성 오버레이 이미지 조회: ${sportCode}`);
    
    // 활성 이미지들 조회 (다중 지원)
    const activeImages = await SportActiveOverlayImage.findAll({
      where: { sport_code: sportCode }
    });
    
    if (activeImages && activeImages.length > 0) {
      // 모든 활성 이미지의 상세 정보 조회
      const imageDetails = [];
      const activeImageList = [];
      
      for (const activeImage of activeImages) {
        if (activeImage.active_image_id) {
          const imageDetail = await SportOverlayImage.findByPk(activeImage.active_image_id);
          if (imageDetail) {
            imageDetails.push({
              id: imageDetail.id,
              filename: imageDetail.filename,
              file_path: imageDetail.file_path,
              is_active: imageDetail.is_active,
              upload_time: imageDetail.upload_time
            });
            
            activeImageList.push({
              id: activeImage.id,
              filename: imageDetail.filename,
              file_path: imageDetail.file_path,
              activated_at: activeImage.activated_at
            });
          }
        }
      }
      
      res.json({
        success: true,
        sportCode: sportCode,
        images: imageDetails,
        activeImages: activeImageList
      });
    } else {
      res.json({
        success: true,
        sportCode: sportCode,
        images: [],
        activeImages: []
      });
    }
    
  } catch (error) {
    console.error('활성 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '활성 이미지 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

// ========================================
// 오버레이 이미지 상태 관리 API
// ========================================

// GET /api/overlay-images/status/:sportCode/:filename - 이미지 상태 조회
router.get('/status/:sportCode/:filename', asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    console.log(`🔧 이미지 상태 조회: ${sportCode}/${filename}`);
    
    // 이미지 레코드 조회
    const image = await SportOverlayImage.findOne({
      where: { 
        sport_code: sportCode,
        filename: filename 
      }
    });
    
    if (image) {
      res.json({
        success: true,
        exists: true,
        isActive: image.is_active,
        sportCode: sportCode,
        filename: filename
      });
    } else {
      res.json({
        success: true,
        exists: false,
        sportCode: sportCode,
        filename: filename
      });
    }
    
  } catch (error) {
    console.error('이미지 상태 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '이미지 상태 조회에 실패했습니다.',
      error: error.message 
    });
  }
}));

// PUT /api/overlay-images/status/:sportCode/:filename - 이미지 상태 변경
router.put('/status/:sportCode/:filename', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    const { isActive } = req.body;
    
    console.log(`🔧 이미지 상태 변경: ${sportCode}/${filename} -> ${isActive}`);
    
    // 먼저 정확한 파일명으로 조회
    let image = await SportOverlayImage.findOne({
      where: { 
        sport_code: sportCode,
        filename: filename 
      }
    });
    
    // 정확한 파일명으로 찾지 못한 경우, 모든 이미지를 조회하여 파일명 비교
    if (!image) {
      console.log(`🔧 정확한 파일명으로 찾지 못함, 전체 이미지 조회 중...`);
      const allImages = await SportOverlayImage.findAll({
        where: { sport_code: sportCode }
      });
      
      // 파일명 디코딩하여 비교
      for (const img of allImages) {
        let dbFilename = img.filename;
        
        // 깨진 파일명인지 확인하고 디코딩
        if (dbFilename.includes('ì') || dbFilename.includes('ë') || dbFilename.includes('í') || 
            dbFilename.includes('â') || dbFilename.includes('ê') || dbFilename.includes('ô')) {
          try {
            const decodedFilename = Buffer.from(dbFilename, 'latin1').toString('utf8');
            console.log(`🔧 데이터베이스 파일명 디코딩: ${dbFilename} -> ${decodedFilename}`);
            
            if (decodedFilename === filename) {
              image = img;
              console.log(`🔧 디코딩된 파일명으로 매칭 성공: ${decodedFilename}`);
              break;
            }
          } catch (error) {
            console.error('파일명 디코딩 실패:', error);
          }
        }
        
        // 원본 파일명과도 비교
        if (dbFilename === filename) {
          image = img;
          console.log(`🔧 원본 파일명으로 매칭 성공: ${dbFilename}`);
          break;
        }
      }
    }
    
    if (!image) {
      return res.status(404).json({ 
        success: false, 
        message: '이미지를 찾을 수 없습니다.' 
      });
    }
    
    if (isActive) {
      // 활성화: 해당 이미지만 활성화 (기존 활성 이미지는 유지)
      await image.update({ is_active: true });
      
      // SportActiveOverlayImage에 추가 (중복 체크)
      try {
        const existingActive = await SportActiveOverlayImage.findOne({
          where: { 
            sport_code: sportCode,
            active_image_id: image.id 
          }
        });
        
        if (!existingActive) {
          await SportActiveOverlayImage.create({
            sport_code: sportCode,
            active_image_id: image.id,
            active_image_path: image.file_path,
            activated_at: new Date()
          });
        }
      } catch (error) {
        // 중복 제약 조건 오류는 무시 (이미 존재하는 경우)
        if (error.name !== 'SequelizeUniqueConstraintError') {
          throw error;
        }
      }
      
      // WebSocket 이벤트 전송 (활성화)
      emitOverlayImageUpdate(sportCode, true, {
        id: image.id,
        filename: image.filename,
        file_path: image.file_path,
        activated_at: new Date()
      });
    } else {
      // 비활성화: 해당 이미지만 비활성화
      await image.update({ is_active: false });
      
      // SportActiveOverlayImage에서 해당 이미지만 제거
      await SportActiveOverlayImage.destroy({
        where: { 
          sport_code: sportCode,
          active_image_id: image.id 
        }
      });
      
      // WebSocket 이벤트 전송 (비활성화)
      emitOverlayImageUpdate(sportCode, false, {
        id: image.id,
        filename: image.filename,
        file_path: image.file_path
      });
    }
    
    res.json({
      success: true,
      message: `이미지가 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
      isActive: isActive
    });
    
  } catch (error) {
    console.error('이미지 상태 변경 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '이미지 상태 변경에 실패했습니다.',
      error: error.message 
    });
  }
}));

// ========================================
// 오버레이 이미지 삭제 API
// ========================================

// DELETE /api/overlay-images/delete/:sportCode/:filename - 이미지 삭제
router.delete('/delete/:sportCode/:filename', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    console.log(`🔧 이미지 삭제 요청: ${sportCode}/${filename}`);
    
    // 이미지 레코드 조회
    const image = await SportOverlayImage.findOne({
      where: { 
        sport_code: sportCode,
        filename: filename 
      }
    });
    
    if (!image) {
      return res.status(404).json({ 
        success: false, 
        message: '이미지를 찾을 수 없습니다.' 
      });
    }
    
    // 활성 이미지에서 제거
    await SportActiveOverlayImage.destroy({
      where: { sport_code: sportCode }
    });
    
    // 물리적 파일 삭제
    const filePath = path.join(__dirname, '..', 'public', 'overlay-images', sportCode, filename);
    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
      console.log(`🔧 물리적 파일 삭제: ${filePath}`);
    }
    
    // 데이터베이스 레코드 삭제
    await image.destroy();
    
    console.log(`✅ 이미지 삭제 완료: ${filename}`);
    
    res.json({
      success: true,
      message: '이미지가 성공적으로 삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('이미지 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '이미지 삭제에 실패했습니다.',
      error: error.message 
    });
  }
}));

// 팀로고 업로드를 위한 multer 설정
const teamLogoUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const sportType = req.params.sportType.toUpperCase();
      const dir = path.join(__dirname, '..', 'public', 'TEAMLOGO', sportType);
      
      // 종목별 폴더가 없으면 생성
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
        console.log(`🔧 팀로고 폴더 생성: ${dir}`);
      }
      
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      // 한글 파일명 처리
      let originalName = file.originalname;
      
      // 깨진 파일명인지 확인하고 디코딩 시도
      if (originalName.includes('ì') || originalName.includes('ë') || originalName.includes('í')) {
        try {
          const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
          console.log(`🔧 팀로고 파일명 디코딩: ${originalName} -> ${decoded}`);
          originalName = decoded;
        } catch (error) {
          console.error('🔧 팀로고 파일명 디코딩 실패:', error);
        }
      }
      
      console.log(`🔧 팀로고 파일명 처리: ${originalName}`);
      cb(null, originalName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: function (req, file, cb) {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// POST /api/overlay-images/TEAMLOGO/:sportType - 팀로고 업로드
router.post('/TEAMLOGO/:sportType', teamLogoUpload.single('logo'), async (req, res) => {
  try {
    const { sportType } = req.params;
    const sportTypeUpper = sportType.toUpperCase();
    
    console.log(`팀 로고 업로드 요청: matchId=${req.body.matchId}, teamType=${req.body.teamType}, sportType=${sportTypeUpper}`);
    
    // matchId와 teamType이 있는지 확인
    if (!req.body.matchId || !req.body.teamType) {
      console.warn(`필수 파라미터 누락: matchId=${req.body.matchId}, teamType=${req.body.teamType}`);
      return res.status(400).json({ success: false, message: '필수 파라미터가 누락되었습니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    }
    
    // 원본 파일명을 안전하게 처리
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // 최종 저장 경로 설정
    const targetDir = path.join(__dirname, '../public', 'TEAMLOGO', sportTypeUpper);
    const targetPath = path.join(targetDir, originalName);
    
    // 대상 디렉토리 생성
    if (!fsSync.existsSync(targetDir)) {
      fsSync.mkdirSync(targetDir, { recursive: true });
      console.log(`디렉토리 생성됨: ${targetDir}`);
    }
    
    // Multer diskStorage에서 이미 파일이 저장되었으므로 복사만 수행
    if (req.file.path !== targetPath) {
      await fs.copyFile(req.file.path, targetPath);
      // 임시 파일 삭제
      await fs.unlink(req.file.path);
    }
    
    // 파일이 올바르게 저장되었는지 확인
    if (!fsSync.existsSync(targetPath)) {
      console.error(`파일 저장 실패: ${targetPath}`);
      return res.status(500).json({ 
        success: false, 
        message: '파일 저장에 실패했습니다.' 
      });
    }
    
    // 로고 파일 경로 생성 (public 폴더 기준 상대 경로) - DB에는 한글 파일명 그대로 저장
    const logoPath = `TEAMLOGO/${sportTypeUpper}/${originalName}`;
    
    // TeamInfo 테이블에 팀로고 정보 저장
    console.log(`팀로고 업로드 요청 데이터: matchId=${req.body.matchId}, teamType=${req.body.teamType}, sportType=${sportTypeUpper}`);
    
    if (req.body.matchId && req.body.teamType) {
      try {
        const { sequelize } = require('../models');
        const bgColor = req.body.bgColor || '#ffffff';
        
        // TeamInfo 테이블 업데이트
        await sequelize.query(`
          UPDATE TeamInfo 
          SET logo_path = ?, logo_bg_color = ?, updated_at = CURRENT_TIMESTAMP
          WHERE match_id = ? AND team_type = ?
        `, {
          replacements: [logoPath, bgColor, req.body.matchId, req.body.teamType],
          type: sequelize.QueryTypes.UPDATE
        });
        
        console.log(`TeamInfo 테이블 로고 정보 업데이트 완료: matchId=${req.body.matchId}, teamType=${req.body.teamType}`);
        
        // WebSocket을 통한 실시간 업데이트 이벤트 전송
        const io = req.app.get('io');
        if (io) {
          const roomName = `match_${req.body.matchId}`;
          io.to(roomName).emit('teamLogoUpdated', {
            matchId: req.body.matchId,
            teamType: req.body.teamType,
            logoPath: logoPath,
            logoBgColor: bgColor
          });
          console.log(`WebSocket 팀 로고 업데이트 이벤트 전송: room=${roomName}`);
        }
      } catch (dbError) {
        console.error('TeamInfo 테이블 업데이트 오류:', dbError);
        // DB 오류는 무시하고 계속 진행
      }
    }
    
    res.json({ 
      success: true, 
      logoPath: logoPath,
      bgColor: '#ffffff', // 기본 배경색
      message: '로고가 성공적으로 업로드되었습니다.'
    });
    
    console.log(`팀 로고 업로드 성공: ${logoPath}, 팀: ${req.body.teamName}, 타입: ${req.body.teamType}, 종목: ${sportTypeUpper}`);
    console.log(`실제 저장 경로: ${targetPath}`);
  } catch (error) {
    console.error('로고 업로드 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '로고 업로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// GET /api/overlay-images/TEAMLOGO/:sportType - 팀로고 목록 조회
router.get('/TEAMLOGO/:sportType', async (req, res) => {
  try {
    const { sportType } = req.params;
    const sportTypeUpper = sportType.toUpperCase();
    
    console.log(`팀로고 목록 조회: ${sportTypeUpper}`);
    
    // TeamInfo 테이블에서 팀로고 정보 조회
    const { sequelize } = require('../models');
    const teamLogos = await sequelize.query(`
      SELECT team_name, logo_path, logo_bg_color, team_type
      FROM TeamInfo 
      WHERE sport_type = ? AND logo_path IS NOT NULL
      ORDER BY team_name
    `, {
      replacements: [sportTypeUpper],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      sportType: sportTypeUpper,
      teamLogos: teamLogos
    });
    
    console.log(`팀로고 목록 조회 완료: ${sportTypeUpper}, 개수: ${teamLogos.length}`);
  } catch (error) {
    console.error('팀로고 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// DELETE /api/overlay-images/TEAMLOGO/:sportType/:filename - 팀로고 삭제
router.delete('/TEAMLOGO/:sportType/:filename', async (req, res) => {
  try {
    const { sportType, filename } = req.params;
    const sportTypeUpper = sportType.toUpperCase();
    
    console.log(`팀로고 삭제 요청: ${sportTypeUpper}/${filename}`);
    
    // 파일 시스템에서 삭제
    const filePath = path.join(__dirname, '../public', 'TEAMLOGO', sportTypeUpper, filename);
    
    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
      console.log(`파일 삭제 완료: ${filePath}`);
    }
    
    // TeamInfo 테이블에서 로고 경로 제거
    const { sequelize } = require('../models');
    await sequelize.query(`
      UPDATE TeamInfo 
      SET logo_path = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE sport_type = ? AND logo_path LIKE ?
    `, {
      replacements: [sportTypeUpper, `%${filename}`],
      type: sequelize.QueryTypes.UPDATE
    });
    
    res.json({
      success: true,
      message: '팀로고가 성공적으로 삭제되었습니다.'
    });
    
    console.log(`팀로고 삭제 완료: ${sportTypeUpper}/${filename}`);
  } catch (error) {
    console.error('팀로고 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
