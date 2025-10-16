const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// 한글 파일명을 영문으로 변환하는 함수
function convertKoreanToEnglish(koreanText) {
  const koreanToEnglish = {
    '연천FC': 'yeoncheon_fc',
    '평택FC': 'pyeongtaek_fc',
    '로고': 'logo',
    'FC': 'fc'
  };
  
  let result = koreanText;
  for (const [korean, english] of Object.entries(koreanToEnglish)) {
    result = result.replace(new RegExp(korean, 'g'), english);
  }
  
  return result;
}

// TEAMLOGO 폴더에 대한 정적 파일 서빙 (Railway Volume 지원)
// Railway Volume이 /app/public에 마운트되어 있으므로 강제로 사용
const teamLogoPath = path.join('/app/public', 'TEAMLOGO');

console.log('🔧 TEAMLOGO 경로 설정:', {
  VOLUME_STORAGE_PATH: process.env.VOLUME_STORAGE_PATH,
  teamLogoPath: teamLogoPath,
  exists: fsSync.existsSync(teamLogoPath)
});

// 팀로고 업로드를 위한 multer 설정 (POST 라우트보다 먼저 정의)
const teamLogoUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const sportType = req.params.sportType.toUpperCase();
      // Railway Volume 사용 (환경변수로 경로 설정)
      // Railway Volume이 /app/public에 마운트되어 있으므로 강제로 사용
      const baseDir = path.join('/app/public', 'TEAMLOGO');
      const dir = path.join(baseDir, sportType);
      
      // 종목별 폴더가 없으면 생성
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
        console.log(`🔧 팀로고 폴더 생성: ${dir}`);
      }
      
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      // 한글 파일명 처리
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      console.log(`🔧 팀로고 파일명 디코딩: ${file.originalname} -> ${originalName}`);
      
      // 원본 파일명 그대로 사용 (수정하지 않음)
      console.log(`🔧 팀로고 파일명 그대로 사용: ${originalName}`);
      
      cb(null, originalName);
    }
  }),
  fileFilter: function (req, file, cb) {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// POST 라우트를 먼저 정의 (미들웨어보다 우선)
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

    // 파일이 없는 경우 (파일 시스템에서 선택한 로고)
    if (!req.file) {
      console.log('파일이 없음 - 파일 시스템에서 선택한 로고 처리');
      
      // 파일 시스템에서 선택한 로고인 경우
      if (req.body.logoPath) {
        const logoPath = req.body.logoPath;
        const logoName = req.body.logoName || '선택된 로고';
        
        console.log(`파일 시스템 로고 선택: ${logoName}, 경로: ${logoPath}`);
        
        // Match 테이블의 match_data JSON 필드에 팀로고 정보 저장
        if (req.body.matchId && req.body.teamType) {
          try {
            const { Match } = require('../models');
            const bgColor = req.body.logoBgColor || req.body.bgColor || '#ffffff';
            
            // 현재 경기 정보 조회
            const match = await Match.findByPk(req.body.matchId);
            if (!match) {
              throw new Error('경기를 찾을 수 없습니다.');
            }
            
            // match_data JSON 필드 업데이트
            const matchData = match.match_data || {};
            const teamKey = req.body.teamType === 'home' ? 'home_team_logo' : 'away_team_logo';
            const bgColorKey = req.body.teamType === 'home' ? 'home_team_colorbg' : 'away_team_colorbg';
            
            matchData[teamKey] = logoPath;
            matchData[bgColorKey] = bgColor;
            
            // Match 테이블 업데이트
            await Match.update({
              match_data: matchData
            }, {
              where: {
                id: req.body.matchId
              }
            });
            
            console.log(`팀로고 정보 저장 완료: ${req.body.teamType}팀, 경로: ${logoPath}`);
            
            return res.json({
              success: true,
              message: '팀로고가 성공적으로 선택되었습니다.',
              logoPath: logoPath,
              teamType: req.body.teamType
            });
          } catch (error) {
            console.error('팀로고 정보 저장 실패:', error);
            return res.status(500).json({
              success: false,
              message: '팀로고 정보 저장에 실패했습니다.',
              error: error.message
            });
          }
        }
      }
      
      return res.status(400).json({ success: false, message: '파일 또는 로고 경로가 필요합니다.' });
    }

    // 파일이 있는 경우 (새로운 파일 업로드)
    console.log(`🔧 팀로고 업로드 처리 시작: ${req.file.originalname}`);
    console.log(`🔧 Multer 저장 경로: ${req.file.path}`);
    console.log(`🔧 Multer 저장 파일명: ${req.file.filename}`);
    
    // 파일 저장 성공 확인
    if (req.file && req.file.path) {
      console.log(`✅ 팀로고 파일 저장 성공: ${req.file.path}`);
    } else {
      console.error('❌ 팀로고 파일 저장 실패');
      return res.status(500).json({ success: false, message: '파일 저장에 실패했습니다.' });
    }

    // 팀로고 정보를 TeamInfo 테이블에 저장
    const { TeamInfo } = require('../models');
    const bgColor = req.body.logoBgColor || req.body.bgColor || '#ffffff';
    
    console.log(`팀로고 업로드 요청 데이터: matchId=${req.body.matchId}, teamType=${req.body.teamType}, sportType=${sportTypeUpper}`);
    
    try {
      // 기존 팀 정보 조회
      const existingTeam = await TeamInfo.findOne({
        where: {
          match_id: req.body.matchId,
          team_type: req.body.teamType
        }
      });

      if (existingTeam) {
        // 기존 팀 정보 업데이트
        await existingTeam.update({
          logo_path: `/api/overlay-images/TEAMLOGO/${sportTypeUpper}/${req.file.filename}`,
          logo_bg_color: bgColor
        });
        
        console.log(`🔧 TeamInfo 기존 레코드 업데이트: ID ${existingTeam.id}, matchId=${req.body.matchId}, teamType=${req.body.teamType}`);
      } else {
        // 새 레코드 생성 (파일 업로드 시에도 TeamInfo 생성)
        const newTeamInfo = await TeamInfo.create({
          match_id: req.body.matchId,
          sport_type: sportTypeUpper,
          team_name: req.body.teamName || `${req.body.teamType}팀`,
          team_type: req.body.teamType,
          logo_path: `/api/overlay-images/TEAMLOGO/${sportTypeUpper}/${req.file.filename}`,
          logo_bg_color: bgColor
        });
        
        console.log(`🔧 TeamInfo 새 레코드 생성: ID ${newTeamInfo.id}, matchId=${req.body.matchId}, teamType=${req.body.teamType}`);
      }

      // WebSocket으로 실시간 업데이트 전송
      const io = req.app.get('io');
      if (io) {
        io.to(`match_${req.body.matchId}`).emit('teamLogoUpdate', {
          teamType: req.body.teamType,
          logoPath: `/api/overlay-images/TEAMLOGO/${sportTypeUpper}/${req.file.filename}`,
          bgColor: bgColor
        });
        console.log(`WebSocket 팀로고 업데이트 이벤트 전송: room=match_${req.body.matchId}, logoPath=/api/overlay-images/TEAMLOGO/${sportTypeUpper}/${req.file.filename}`);
      }

      // 팀 이름 가져오기 (기존 팀 정보에서)
      const teamName = existingTeam ? existingTeam.team_name : `${sportTypeUpper}팀`;
      
      console.log(`팀 로고 업로드 성공: /api/overlay-images/TEAMLOGO/${sportTypeUpper}/${req.file.filename}, 팀: ${teamName}, 타입: ${req.body.teamType}, 종목: ${sportTypeUpper}`);
      console.log(`실제 저장 경로: ${req.file.path}`);
      
      res.json({
        success: true,
        message: '팀로고가 성공적으로 업로드되었습니다.',
        logoPath: `/api/overlay-images/TEAMLOGO/${sportTypeUpper}/${req.file.filename}`,
        teamType: req.body.teamType,
        teamName: teamName
      });
    } catch (error) {
      console.error('팀로고 정보 저장 실패:', error);
      res.status(500).json({
        success: false,
        message: '팀로고 정보 저장에 실패했습니다.',
        error: error.message
      });
    }
  } catch (error) {
    console.error('팀로고 업로드 실패:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 업로드에 실패했습니다.',
      error: error.message
    });
  }
});

// 한글 파일명 처리를 위한 미들웨어
router.use('/TEAMLOGO', async (req, res, next) => {
  console.log('🔧 TEAMLOGO 요청:', {
    originalUrl: req.originalUrl,
    url: req.url,
    decoded: decodeURIComponent(req.url)
  });
  
  try {
    // URL 디코딩
    const decodedUrl = decodeURIComponent(req.url);
    console.log('🔧 디코딩된 URL:', decodedUrl);
    
    // 파일 경로 구성
    const fullPath = path.join(teamLogoPath, decodedUrl);
    console.log('🔧 전체 파일 경로:', fullPath);
    
    // 파일 존재 확인 및 디렉토리 체크
    const fileExists = fsSync.existsSync(fullPath);
    let isDirectory = false;
    if (fileExists) {
      isDirectory = fsSync.statSync(fullPath).isDirectory();
    }
    console.log('🔧 파일 존재 여부:', fileExists, '디렉토리 여부:', isDirectory);
    
    if (fileExists && !isDirectory) {
      // 파일이 존재하고 디렉토리가 아니면 직접 서빙
      const ext = path.extname(fullPath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // 한글 파일명을 위한 Content-Disposition 헤더 설정
      const fileName = path.basename(fullPath);
      if (/[가-힣]/.test(fileName)) {
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      }
      
      // 파일 스트림으로 직접 응답
      const fileStream = fsSync.createReadStream(fullPath);
      fileStream.on('error', (error) => {
        console.error('🔧 파일 스트림 오류:', error);
        res.status(404).send('File not found');
      });
      fileStream.pipe(res);
      return;
    } else {
      console.log('🔧 파일이 존재하지 않거나 디렉토리임, 정적 서빙으로 전달');
    }
  } catch (error) {
    console.error('🔧 파일 처리 중 오류:', error);
  }
  
  next();
});

router.use('/TEAMLOGO', express.static(teamLogoPath, {
  setHeaders: (res, filePath) => {
    console.log('🔧 정적 파일 서빙:', filePath);
    
    // 한글 파일명을 위한 인코딩 설정
    const fileName = path.basename(filePath);
    if (/[가-힣]/.test(fileName)) {
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    }
    
    // 파일 확장자에 따른 Content-Type 설정
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    
    // 팀로고 파일에 대한 캐시 설정
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// 모델들
const { SportOverlayImage, SportActiveOverlayImage, Match, Sport } = require('../models');

// WebSocket 이벤트 전송을 위한 함수 (Room 기반)
const emitOverlayImageUpdate = (sportCode, isActive, imageData = null) => {
  const io = require('../server').getIO();
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
        // Railway Volume 사용 (환경변수로 경로 설정)
        const baseDir = process.env.VOLUME_STORAGE_PATH ? 
            path.join(process.env.VOLUME_STORAGE_PATH, 'overlay-images') : 
            path.join(__dirname, '..', 'public', 'overlay-images');
        const dir = path.join(baseDir, sportFolderName);
        
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
    
    // 물리적 파일 삭제 (Railway Volume 지원)
    const baseDir = process.env.VOLUME_STORAGE_PATH ? 
        path.join(process.env.VOLUME_STORAGE_PATH, 'overlay-images') : 
        path.join(__dirname, '..', 'public', 'overlay-images');
    const filePath = path.join(baseDir, sportCode, filename);
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



// GET /api/overlay-images/TEAMLOGO/:sportType/debug - 팀로고 디버그 정보
router.get('/TEAMLOGO/:sportType/debug', async (req, res) => {
  try {
    const { sportType } = req.params;
    const sportTypeUpper = sportType.toUpperCase();
    
    console.log(`🔧 팀로고 디버그 정보 조회: ${sportTypeUpper}`);
    
    // Volume Storage 경로 확인
    // Railway Volume이 /app/public에 마운트되어 있으므로 강제로 사용
    const baseDir = path.join('/app/public', 'TEAMLOGO');
    const sportDir = path.join(baseDir, sportTypeUpper);
    
    const debugInfo = {
      VOLUME_STORAGE_PATH: process.env.VOLUME_STORAGE_PATH,
      baseDir: baseDir,
      sportDir: sportDir,
      baseDirExists: fsSync.existsSync(baseDir),
      sportDirExists: fsSync.existsSync(sportDir),
      files: []
    };
    
    if (fsSync.existsSync(sportDir)) {
      try {
        const files = fsSync.readdirSync(sportDir);
        debugInfo.files = files.map(file => {
          const filePath = path.join(sportDir, file);
          return {
            name: file,
            path: filePath,
            exists: fsSync.existsSync(filePath),
            size: fsSync.existsSync(filePath) ? fsSync.statSync(filePath).size : 0
          };
        });
      } catch (error) {
        debugInfo.readError = error.message;
      }
    }
    
    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    console.error('팀로고 디버그 정보 조회 실패:', error);
    res.status(500).json({
      success: false,
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
    
    // TeamInfo 기반으로 변경
    try {
      const { TeamInfo, Op } = require('../models');
      
      const teamLogos = await TeamInfo.findAll({
        where: { 
          sport_type: sportTypeUpper,
          logo_path: { [Op.ne]: null } // logo_path가 null이 아닌 것만
        },
        attributes: ['team_name', 'logo_path', 'logo_bg_color'],
        group: ['team_name', 'logo_path', 'logo_bg_color'], // 중복 제거
        order: [['team_name', 'ASC']]
      });
      
      // 기존 형식으로 변환
      const teamLogoMap = {};
      teamLogos.forEach(logo => {
        teamLogoMap[logo.team_name] = {
          path: logo.logo_path,
          bgColor: logo.logo_bg_color
        };
      });
      
      console.log(`✅ 팀로고 맵 변환 완료 (TeamInfo 기반): ${Object.keys(teamLogoMap).length}개 팀`);
      res.json({ teamLogoMap });
      
    } catch (teamInfoError) {
      console.log('TeamInfo 테이블 조회 실패:', teamInfoError.message);
      res.json({
        success: true,
        sportType: sportTypeUpper,
        teamLogos: [],
        message: 'TeamInfo 테이블을 조회할 수 없습니다.'
      });
      return; // 함수 종료
    }
  } catch (error) {
    console.error('팀로고 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// DELETE /api/overlay-images/TEAMLOGO/:sportType/cleanup - 모든 팀로고 삭제 (정리용)
router.delete('/TEAMLOGO/:sportType/cleanup', async (req, res) => {
  try {
    const { sportType } = req.params;
    const sportTypeUpper = sportType.toUpperCase();
    
    console.log(`🔧 팀로고 전체 삭제 요청: ${sportTypeUpper}`);
    
    // 파일 시스템에서 모든 파일 삭제
    // Railway Volume이 /app/public에 마운트되어 있으므로 강제로 사용
    const baseDir = path.join('/app/public', 'TEAMLOGO');
    const sportDir = path.join(baseDir, sportTypeUpper);
    
    let deletedCount = 0;
    if (fsSync.existsSync(sportDir)) {
      const files = fsSync.readdirSync(sportDir);
      
      files.forEach(file => {
        try {
          const filePath = path.join(sportDir, file);
          fsSync.unlinkSync(filePath);
          deletedCount++;
          console.log(`🔧 파일 삭제: ${file}`);
        } catch (error) {
          console.error(`🔧 파일 삭제 실패: ${file}`, error);
        }
      });
      
      console.log(`🔧 팀로고 파일 삭제 완료: ${deletedCount}개`);
    } else {
      console.log(`🔧 팀로고 디렉토리가 존재하지 않음: ${sportDir}`);
    }
    
    // DB에서 모든 팀로고 정보 삭제 (TeamInfo 테이블)
    try {
      const { TeamInfo } = require('../models');
      if (TeamInfo) {
        await TeamInfo.destroy({
          where: {
            sport_type: sportTypeUpper
          }
        });
        console.log(`🔧 TeamInfo 테이블 삭제 완료: ${sportTypeUpper}`);
      }
    } catch (dbError) {
      console.log(`🔧 TeamInfo 테이블 삭제 건너뜀: ${dbError.message}`);
    }
    
    console.log(`🔧 DB 팀로고 정보 삭제 완료: ${sportTypeUpper}`);
    
    res.json({
      success: true,
      message: `${sportTypeUpper} 팀로고가 모두 삭제되었습니다.`,
      deletedFiles: deletedCount
    });
  } catch (error) {
    console.error('팀로고 전체 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 삭제에 실패했습니다.',
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
    // Railway Volume 지원
    const baseDir = process.env.VOLUME_STORAGE_PATH ? 
        path.join(process.env.VOLUME_STORAGE_PATH, 'TEAMLOGO') : 
        path.join(__dirname, '../public', 'TEAMLOGO');
    const filePath = path.join(baseDir, sportTypeUpper, filename);
    
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

// ========================================
// 오버레이 상태 관리 API
// ========================================

// GET /api/overlay-status/:listId - 리스트 오버레이 상태 조회
router.get('/overlay-status/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    console.log(`리스트 오버레이 상태 조회: ${listId}`);

    // MatchList 모델 사용
    const { MatchList } = require('../models');
    
    // MatchList 모델이 존재하는지 확인
    if (!MatchList) {
      console.error('MatchList 모델이 로드되지 않았습니다.');
      return res.status(500).json({ 
        success: false, 
        error: 'MatchList 모델을 찾을 수 없습니다.' 
      });
    }

    // 리스트 정보 조회
    const matchList = await MatchList.findByPk(listId);
    
    if (!matchList) {
      console.log(`리스트를 찾을 수 없음: ${listId}`);
      return res.status(404).json({ 
        success: false, 
        message: '리스트를 찾을 수 없습니다.' 
      });
    }

    // 리스트가 활성화되어 있고 경기가 있는지 확인
    const isActive = matchList.is_active && matchList.matches && matchList.matches.length > 0;
    
    console.log(`리스트 오버레이 상태: ${listId}, 활성: ${isActive}, 경기 수: ${matchList.matches ? matchList.matches.length : 0}`);
    
    res.json({
      success: true,
      listId: listId,
      isActive: isActive,
      matchCount: matchList.matches ? matchList.matches.length : 0,
      message: isActive ? '오버레이가 활성화되어 있습니다.' : '오버레이가 비활성화되어 있습니다.'
    });
  } catch (error) {
    console.error('리스트 오버레이 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '오버레이 상태 조회 중 서버 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// GET /api/overlay-images/TEAMLOGO/:sportType - 팀로고 목록 조회 (팀 정보 수정용)
router.get('/TEAMLOGO/:sportType', async (req, res) => {
  try {
    const { sportType } = req.params;
    const sportTypeUpper = sportType.toUpperCase();
    
    console.log(`팀로고 목록 조회: ${sportTypeUpper}`);
    
    // 팀로고 폴더 경로 (업로드와 동일한 로직 사용)
    const baseDir = process.env.VOLUME_STORAGE_PATH ? 
        path.join(process.env.VOLUME_STORAGE_PATH, 'TEAMLOGO') : 
        path.join(__dirname, '..', 'public', 'TEAMLOGO');
    const teamLogoDir = path.join(baseDir, sportTypeUpper);
    
    // 폴더 존재 여부 확인
    if (!fsSync.existsSync(teamLogoDir)) {
      console.log(`팀로고 폴더가 존재하지 않음: ${teamLogoDir}`);
      return res.json({
        success: true,
        sportType: sportTypeUpper,
        teamLogos: [],
        message: '팀로고 폴더가 존재하지 않습니다.'
      });
    }
    
    // 폴더 내 파일 목록 조회
    const files = fsSync.readdirSync(teamLogoDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
    
    console.log(`팀로고 파일 개수: ${imageFiles.length}`);
    console.log(`팀로고 파일 목록:`, imageFiles);
    
    // 팀로고 정보 생성
    const teamLogos = imageFiles.map(file => {
      const filePath = path.join(teamLogoDir, file);
      const stats = fsSync.statSync(filePath);
      
      return {
        filename: file,
        path: `/api/overlay-images/TEAMLOGO/${sportTypeUpper}/${file}`,
        displayName: file.replace(/\.[^/.]+$/, ""), // 확장자 제거한 파일명
        size: stats.size,
        modified: stats.mtime
      };
    });
    
    res.json({
      success: true,
      sportType: sportTypeUpper,
      teamLogos: teamLogos,
      count: teamLogos.length
    });
    
  } catch (error) {
    console.error('팀로고 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 목록 조회 중 서버 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// DELETE /api/overlay-images/delete-team-logo - 팀로고 삭제
router.delete('/delete-team-logo', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { logoPath } = req.body;
    console.log(`🔧 팀로고 삭제 요청: ${logoPath}`);
    
    if (!logoPath) {
      return res.status(400).json({
        success: false,
        message: '로고 경로가 필요합니다.'
      });
    }
    
    // 로고 경로에서 실제 파일 경로 추출
    const pathParts = logoPath.split('/');
    const sportType = pathParts[pathParts.length - 2];
    const fileName = pathParts[pathParts.length - 1];
    
    // 실제 파일 경로 구성
    const baseDir = process.env.VOLUME_STORAGE_PATH ? 
      path.join(process.env.VOLUME_STORAGE_PATH, 'TEAMLOGO') : 
      path.join(__dirname, '../public/TEAMLOGO');
    const sportDir = path.join(baseDir, sportType);
    const filePath = path.join(sportDir, fileName);
    
    console.log(`🔧 삭제할 파일 경로: ${filePath}`);
    
    // 파일 존재 확인
    try {
      await fs.access(filePath);
    } catch (error) {
      console.log(`⚠️ 파일이 존재하지 않음: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }
    
    // 파일 삭제
    await fs.unlink(filePath);
    console.log(`✅ 팀로고 파일 삭제 완료: ${filePath}`);
    
    // TeamInfo 테이블에서 해당 로고 경로를 사용하는 레코드들의 logo_path를 null로 설정
    try {
      const { TeamInfo } = require('../models');
      await TeamInfo.update(
        { logo_path: null },
        { where: { logo_path: logoPath } }
      );
      console.log(`✅ TeamInfo 테이블에서 로고 경로 제거 완료: ${logoPath}`);
    } catch (dbError) {
      console.warn(`⚠️ TeamInfo 테이블 업데이트 실패: ${dbError.message}`);
    }
    
    res.json({
      success: true,
      message: '팀로고가 성공적으로 삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('팀로고 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '팀로고 삭제에 실패했습니다.',
      error: error.message
    });
  }
}));

module.exports = router;
