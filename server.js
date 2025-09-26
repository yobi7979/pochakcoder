const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const { sequelize, Match, Settings, MatchList, SportOverlayImage, SportActiveOverlayImage, User } = require('./models');
const BackupRestoreManager = require('./backup-restore');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const Sport = require('./models/Sport');
const Template = require('./models/Template');
const { Op } = require('sequelize');
const session = require('express-session');
const ejs = require('ejs');

// 로그 디렉토리 생성
const logDir = path.join(__dirname, 'logs');
if (!fsSync.existsSync(logDir)) {
  fsSync.mkdirSync(logDir, { recursive: true });
}

// 로깅 설정
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 에러 로그 (별도 파일)
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // 일반 로그 (자동 로테이션)
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    // 콘솔 출력 (개발 환경에서만)
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    // 소켓 연결 최적화 설정
    pingTimeout: 60000, // 60초
    pingInterval: 25000, // 25초
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // 메모리 사용량 최적화
    maxHttpBufferSize: 1e6, // 1MB
    // 연결 풀 크기 제한
    maxHttpBufferSize: 1e6,
    // 핑/퐁 최적화
    pingTimeout: 60000,
    pingInterval: 25000
});

// 현재 푸시된 경기 정보를 저장하는 객체
const pushedMatches = new Map(); // listId -> { matchId, matchIndex, timestamp }

// 자동 로그 관리 설정
const LOG_MANAGEMENT_CONFIG = {
  AUTO_BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24시간 (밀리초)
  MAX_LOG_SIZE_MB: 50, // 로그 파일 최대 크기 (MB)
  MAX_TOTAL_LOG_SIZE_MB: 200, // 전체 로그 최대 크기 (MB)
  BACKUP_RETENTION_DAYS: 30 // 백업 파일 보관 기간 (일)
};

// 자동 로그 백업 함수
async function autoBackupLogs() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'logs', 'auto-backup', timestamp);
    
    if (!fsSync.existsSync(backupDir)) {
      fsSync.mkdirSync(backupDir, { recursive: true });
    }
    
    const files = fsSync.readdirSync(logDir);
    let backedUpFiles = 0;
    
    files.forEach(file => {
      if (file.endsWith('.log') && !file.includes('backup')) {
        const sourcePath = path.join(logDir, file);
        const destPath = path.join(backupDir, file);
        fsSync.copyFileSync(sourcePath, destPath);
        backedUpFiles++;
      }
    });
    
    logger.info(`자동 로그 백업 완료: ${backedUpFiles}개 파일, 경로: ${backupDir}`);
    
    // 오래된 백업 파일 정리
    cleanupOldBackups();
    
  } catch (error) {
    logger.error('자동 로그 백업 실패:', error);
  }
}

// 오래된 백업 파일 정리
async function cleanupOldBackups() {
  try {
    const backupDir = path.join(__dirname, 'logs', 'auto-backup');
    if (!fsSync.existsSync(backupDir)) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_MANAGEMENT_CONFIG.BACKUP_RETENTION_DAYS);
    
    const backupFolders = fsSync.readdirSync(backupDir);
    let deletedFolders = 0;
    
    backupFolders.forEach(folder => {
      const folderPath = path.join(backupDir, folder);
      const stats = fsSync.statSync(folderPath);
      
      if (stats.isDirectory() && stats.mtime < cutoffDate) {
        // 폴더 내 모든 파일 삭제 후 폴더 삭제
        const files = fsSync.readdirSync(folderPath);
        files.forEach(file => {
          fsSync.unlinkSync(path.join(folderPath, file));
        });
        fsSync.rmdirSync(folderPath);
        deletedFolders++;
      }
    });
    
    if (deletedFolders > 0) {
      logger.info(`오래된 백업 폴더 정리 완료: ${deletedFolders}개 폴더 삭제`);
    }
  } catch (error) {
    logger.error('오래된 백업 파일 정리 실패:', error);
  }
}

// 로그 크기 체크 및 자동 관리
async function checkAndManageLogs() {
  try {
    const files = fsSync.readdirSync(logDir);
    let totalSize = 0;
    const logFiles = [];
    
    // 로그 파일 크기 계산
    files.forEach(file => {
      if (file.endsWith('.log') && !file.includes('backup')) {
        const filePath = path.join(logDir, file);
        const stats = fsSync.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);
        totalSize += sizeMB;
        logFiles.push({ name: file, sizeMB, path: filePath });
      }
    });
    
    // 전체 로그 크기가 제한을 초과하면 자동 백업 후 초기화
    if (totalSize > LOG_MANAGEMENT_CONFIG.MAX_TOTAL_LOG_SIZE_MB) {
      logger.warn(`로그 크기 제한 초과: ${totalSize.toFixed(2)}MB > ${LOG_MANAGEMENT_CONFIG.MAX_TOTAL_LOG_SIZE_MB}MB`);
      
      // 자동 백업 실행
      await autoBackupLogs();
      
      // 로그 파일들 초기화
      logFiles.forEach(logFile => {
        fsSync.writeFileSync(logFile.path, '');
      });
      
      logger.info(`로그 자동 초기화 완료: ${logFiles.length}개 파일`);
    }
    
    // 개별 로그 파일 크기 체크
    logFiles.forEach(logFile => {
      if (logFile.sizeMB > LOG_MANAGEMENT_CONFIG.MAX_LOG_SIZE_MB) {
        logger.warn(`개별 로그 파일 크기 제한 초과: ${logFile.name} (${logFile.sizeMB.toFixed(2)}MB)`);
        
        // 개별 파일 백업 후 초기화
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'logs', 'auto-backup', timestamp);
        if (!fsSync.existsSync(backupDir)) {
          fsSync.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, logFile.name);
        fsSync.copyFileSync(logFile.path, backupPath);
        fsSync.writeFileSync(logFile.path, '');
        
        logger.info(`개별 로그 파일 자동 백업 및 초기화: ${logFile.name}`);
      }
    });
    
  } catch (error) {
    logger.error('로그 크기 체크 및 관리 실패:', error);
  }
}

// 자동 로그 관리 스케줄러 시작
function startLogManagementScheduler() {
  // 1일마다 자동 백업
  setInterval(autoBackupLogs, LOG_MANAGEMENT_CONFIG.AUTO_BACKUP_INTERVAL);
  
  // 1시간마다 로그 크기 체크
  setInterval(checkAndManageLogs, 60 * 60 * 1000);
  
  logger.info('자동 로그 관리 스케줄러가 시작되었습니다.');
}

// 팀 로고 업로드를 위한 multer 설정
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
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

// CSV 파일 업로드를 위한 별도 multer 설정
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  },
  fileFilter: function (req, file, cb) {
    // CSV 파일, 텍스트 파일을 허용
    const allowedTypes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'];
    // mimetype 검사 대신 파일 확장자 검사
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.txt') {
      const error = new Error('지원하지 않는 파일 형식입니다. CSV 또는 TXT 파일만 업로드 가능합니다.');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    cb(null, true);
  }
});

// 오버레이 이미지 업로드를 위한 multer 설정
const overlayImageUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, 'public', 'overlay-images');
            if (!fsSync.existsSync(dir)) {
                fsSync.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            // 원본 파일명을 안전하게 처리하고 타임스탬프 추가
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext = path.extname(originalName);
            const nameWithoutExt = path.basename(originalName, ext);
            const timestamp = Date.now();
            cb(null, `${nameWithoutExt}_${timestamp}${ext}`);
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

// 종목별 오버레이 이미지 업로드를 위한 multer 설정
const sportOverlayImageUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const sportCode = req.body.sportCode || 'default';
            const dir = path.join(__dirname, 'public', 'overlay-images', sportCode);
            if (!fsSync.existsSync(dir)) {
                fsSync.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            // 원본 파일명을 안전하게 처리하고 타임스탬프 추가
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext = path.extname(originalName);
            const nameWithoutExt = path.basename(originalName, ext);
            const timestamp = Date.now();
            cb(null, `${nameWithoutExt}_${timestamp}${ext}`);
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

// 백업 파일 업로드를 위한 multer 설정
const backupUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const tempDir = path.join(__dirname, 'temp');
            if (!fsSync.existsSync(tempDir)) {
                fsSync.mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
        },
        filename: function (req, file, cb) {
            const timestamp = Date.now();
            cb(null, `backup_${timestamp}.zip`);
        }
    }),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    },
    fileFilter: function (req, file, cb) {
        // ZIP 파일만 허용
        if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || 
            path.extname(file.originalname).toLowerCase() === '.zip') {
            cb(null, true);
        } else {
            cb(new Error('지원하지 않는 파일 형식입니다. ZIP 파일만 업로드 가능합니다.'));
        }
    }
});

// HEX 색상을 RGB로 변환하는 함수
function hexToRgb(hex) {
    // # 제거
    hex = hex.replace('#', '');
    
    // HEX 값을 RGB로 변환
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
}

// 기본 팀 컬러 가져오기 함수
async function getDefaultTeamColors() {
  try {
    const settings = await Settings.findAll();
    const settingsObj = {};
    
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    return {
      home: settingsObj.default_home_color || '#1e40af',
      away: settingsObj.default_away_color || '#1e40af'
    };
  } catch (error) {
    logger.error('기본 팀 컬러 조회 실패:', error);
    return {
      home: '#1e40af',
      away: '#1e40af'
    };
  }
}

// EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS 템플릿에 함수 전달
app.locals.hexToRgb = hexToRgb;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    // 한글 파일명을 위한 인코딩 설정
    if (path.includes('overlay-images')) {
      res.set('Content-Type', 'image/*');
    }
  }
}));
app.use('/views', express.static('views'));

// 한글 파일명을 가진 오버레이 이미지 처리
app.get('/overlay-images/:sportCode/:filename(*)', (req, res) => {
  const { sportCode, filename } = req.params;
  const filePath = path.join(__dirname, 'public', 'overlay-images', sportCode, filename);
  
  // 파일 존재 여부 확인
  if (fsSync.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// 세션 설정
app.use(session({
  secret: 'sports-coder-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // 개발 환경에서는 false로 설정
}));

// 사용자 정보를 템플릿에 전달하는 미들웨어 (모든 라우트에 적용)
app.use(addUserToTemplate);

// 인증 관련 설정
const AUTH_CONFIG = {
  username: 'admin',
  password: 'sports2024'
};

// 인증 미들웨어
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    return res.redirect('/login');
  }
}

// 관리자 권한 미들웨어
function requireAdmin(req, res, next) {
  if (req.session && req.session.authenticated && req.session.userRole === 'admin') {
    return next();
  } else {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
}

// 사용자 정보를 템플릿에 전달하는 미들웨어
function addUserToTemplate(req, res, next) {
  if (req.session && req.session.authenticated) {
    res.locals.userRole = req.session.userRole;
    res.locals.username = req.session.username;
    res.locals.userId = req.session.userId;
  }
  next();
}

// 로그인 페이지는 인증 없이 접근 가능
app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/matches');
  }
  res.render('login', { error: null });
});

// 로그인 처리
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // 데이터베이스에서 사용자 찾기
    const user = await User.findOne({ 
      where: { 
        username: username,
        is_active: true 
      } 
    });
    
    if (user && user.password === password) {
      // 로그인 성공
      req.session.authenticated = true;
      req.session.username = username;
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      // 마지막 로그인 시간 업데이트
      await user.update({ last_login: new Date() });
      
      logger.info(`사용자 로그인 성공: ${username} (${user.role})`);
      res.redirect('/matches');
    } else {
      // 로그인 실패
      logger.warn(`로그인 실패 시도: ${username}`);
      res.render('login', { 
        error: '사용자명 또는 비밀번호가 올바르지 않습니다.',
        username: username 
      });
    }
  } catch (error) {
    logger.error('로그인 처리 중 오류:', error);
    res.render('login', { 
      error: '로그인 처리 중 오류가 발생했습니다.',
      username: username 
    });
  }
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      logger.error('세션 삭제 오류:', err);
    } else {
      logger.info(`사용자 로그아웃: ${username}`);
    }
    res.redirect('/login');
  });
});

// 사용자 관리 페이지
app.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['created_at', 'DESC']]
    });
    res.render('user-management', { users });
  } catch (error) {
    logger.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 추가 API
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    
    // 중복 사용자명 확인
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
    }
    
    // 새 사용자 생성
    const newUser = await User.create({
      username,
      password, // 실제 운영에서는 해싱 필요
      full_name,
      email,
      role: role || 'user'
    });
    
    logger.info(`새 사용자 생성: ${username}`);
    res.json({ success: true, user: newUser });
  } catch (error) {
    logger.error('사용자 생성 실패:', error);
    res.status(500).json({ error: '사용자 생성에 실패했습니다.' });
  }
});

// 사용자 조회 API
app.get('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json(user);
  } catch (error) {
    logger.error('사용자 조회 실패:', error);
    res.status(500).json({ error: '사용자 조회에 실패했습니다.' });
  }
});

// 사용자 수정 API
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, email, role, is_active } = req.body;
    const userId = req.params.id;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 사용자명 중복 확인 (자기 자신 제외)
    if (username !== user.username) {
      const existingUser = await User.findOne({ 
        where: { 
          username,
          id: { [Op.ne]: userId }
        } 
      });
      if (existingUser) {
        return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
      }
    }
    
    // 업데이트할 데이터 준비
    const updateData = {
      username,
      full_name,
      email,
      role,
      is_active
    };
    
    // 비밀번호가 제공된 경우에만 업데이트
    if (password && password.trim() !== '') {
      updateData.password = password; // 실제 운영에서는 해싱 필요
    }
    
    await user.update(updateData);
    
    logger.info(`사용자 정보 수정: ${username}`);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('사용자 수정 실패:', error);
    res.status(500).json({ error: '사용자 수정에 실패했습니다.' });
  }
});

// 사용자 삭제 API
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 관리자 권한 확인 (마지막 관리자는 삭제 불가)
    if (user.role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '마지막 관리자는 삭제할 수 없습니다.' });
      }
    }
    
    await user.destroy();
    
    logger.info(`사용자 삭제: ${user.username}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('사용자 삭제 실패:', error);
    res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
  }
});

// 독립 타이머 상태 저장 (경기별)
const matchTimerData = new Map();
const pendingDbUpdates = new Map(); // DB 업데이트 대기열
const DB_BATCH_INTERVAL = 5000; // 5초마다 배치 업데이트

// 배치 DB 업데이트 함수
async function batchUpdateMatchData() {
    try {
        const updates = Array.from(pendingDbUpdates.entries());
        if (updates.length === 0) return;

        logger.info(`배치 DB 업데이트 시작: ${updates.length}개 경기`);
        
        for (const [matchId, matchData] of updates) {
            try {
                const match = await Match.findByPk(matchId);
                if (match) {
                    await match.update({
                        match_data: {
                            ...match.match_data,
                            ...matchData,
                            lastBatchUpdate: Date.now()
                        }
                    });
                }
            } catch (error) {
                logger.error(`경기 ${matchId} 배치 업데이트 실패:`, error);
            }
        }
        
        pendingDbUpdates.clear();
        logger.info('배치 DB 업데이트 완료');
    } catch (error) {
        logger.error('배치 DB 업데이트 중 오류:', error);
    }
}

// 배치 업데이트 스케줄러 시작
setInterval(batchUpdateMatchData, DB_BATCH_INTERVAL);

// 독립 타이머 관리 함수
function startMatchTimer(matchId) {
    let timerData = matchTimerData.get(matchId);
    
    if (!timerData) {
        // 타이머 데이터가 없으면 새로 생성
        timerData = {
            startTime: Date.now(),
            pausedTime: 0,
            isRunning: true,
            matchId: matchId
        };
        logger.info(`새 타이머 데이터 생성: matchId=${matchId}`);
    } else {
        // 기존 타이머 데이터 업데이트
        if (timerData.isRunning) {
            // 이미 실행 중이면 아무것도 하지 않음
            logger.info(`타이머가 이미 실행 중: matchId=${matchId}`);
            return;
        }
        
        const oldStartTime = timerData.startTime;
        const oldPausedTime = timerData.pausedTime;
        timerData.startTime = Date.now();  // 현재 시간을 시작 시간으로 설정
        timerData.isRunning = true;
        // pausedTime은 그대로 유지 (현재 시간에서 계속 시작)
        logger.info(`기존 타이머 데이터 업데이트: matchId=${matchId}, oldStartTime=${oldStartTime}, oldPausedTime=${oldPausedTime}, newStartTime=${timerData.startTime}, pausedTime=${timerData.pausedTime}`);
    }
    
    matchTimerData.set(matchId, timerData);
    
    // DB 업데이트 대기열에 추가
    pendingDbUpdates.set(matchId, {
        timer_startTime: timerData.startTime,
        timer_pausedTime: timerData.pausedTime,
        isRunning: true,
        lastUpdateTime: Date.now()
    });
    
    // 새로운 독립 타이머 이벤트 전송
    io.to(`match_${matchId}`).emit('timer_started', timerData);
    
    logger.info(`타이머 시작 완료: matchId=${matchId}, startTime=${timerData.startTime}, pausedTime=${timerData.pausedTime}, isRunning=${timerData.isRunning}`);
}

function stopMatchTimer(matchId, clientTime = null) {
    const timerData = matchTimerData.get(matchId);
    if (timerData && timerData.isRunning) {
        // 클라이언트에서 전송한 시간을 우선 사용, 없으면 서버에서 계산
        let pausedTime;
        if (clientTime !== null) {
            pausedTime = clientTime;
            logger.info(`클라이언트 시간 사용: matchId=${matchId}, clientTime=${clientTime}`);
        } else {
            // 현재 경과 시간 계산
            const currentTime = Date.now();
            const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
            pausedTime = elapsedTime;
            logger.info(`서버 시간 계산: matchId=${matchId}, elapsedTime=${elapsedTime}`);
        }
        
        timerData.pausedTime = pausedTime;
        timerData.isRunning = false;
        
        matchTimerData.set(matchId, timerData);
        
        // DB 업데이트 대기열에 추가
        pendingDbUpdates.set(matchId, {
            timer_startTime: timerData.startTime,
            timer_pausedTime: timerData.pausedTime,
            isRunning: false,
            lastUpdateTime: Date.now()
        });
        
        // 새로운 독립 타이머 이벤트 전송
        io.to(`match_${matchId}`).emit('timer_stopped', timerData);
        
        logger.info(`타이머 정지: matchId=${matchId}, pausedTime=${timerData.pausedTime}`);
    }
}

function resetMatchTimer(matchId) {
    const timerData = {
        startTime: 0, // 리셋 시에는 startTime을 0으로 설정
        pausedTime: 0,
        isRunning: false,
        matchId: matchId
    };
    
    matchTimerData.set(matchId, timerData);
    
    // DB 업데이트 대기열에 추가
    pendingDbUpdates.set(matchId, {
        timer_startTime: timerData.startTime,
        timer_pausedTime: timerData.pausedTime,
        isRunning: false,
        lastUpdateTime: Date.now()
    });
    
    // 해당 경기 방에만 타이머 리셋 이벤트 전송
    io.to(`match_${matchId}`).emit('timer_reset', timerData);
    
    logger.info(`타이머 리셋: matchId=${matchId}`);
}

function setMatchTimer(matchId, minutes, seconds) {
    const targetTime = (minutes * 60) + seconds;
    
    // 기존 타이머가 실행 중이었다면 정지
    const existingTimer = matchTimerData.get(matchId);
    if (existingTimer && existingTimer.isRunning) {
        const currentTime = Date.now();
        const elapsedTime = Math.floor((currentTime - existingTimer.startTime) / 1000);
        existingTimer.pausedTime = elapsedTime;
        existingTimer.isRunning = false;
        matchTimerData.set(matchId, existingTimer);
    }
    
    const timerData = {
        startTime: 0, // 설정 시에는 startTime을 0으로 설정하여 정확한 시간에서 시작
        pausedTime: targetTime,
        isRunning: false,
        matchId: matchId
    };
    
    matchTimerData.set(matchId, timerData);
    
    // DB 업데이트 대기열에 추가
    pendingDbUpdates.set(matchId, {
        timer_startTime: timerData.startTime,
        timer_pausedTime: timerData.pausedTime,
        isRunning: false,
        lastUpdateTime: Date.now()
    });
    
    // 해당 경기 방에만 타이머 설정 이벤트 전송
    io.to(`match_${matchId}`).emit('timer_set', timerData);
    
    logger.info(`타이머 설정: matchId=${matchId}, minutes=${minutes}, seconds=${seconds}, targetTime=${targetTime}`);
}

// 서버 시작 시 저장된 타이머 상태 복원
async function restoreMatchTimers() {
    try {
        const matches = await Match.findAll();
        for (const match of matches) {
            const matchData = match.match_data || {};
            
            // 새로운 타이머 데이터 구조로 복원
            const timerData = {
                startTime: matchData.timer_startTime || Date.now(),
                pausedTime: matchData.timer_pausedTime || 0,
                isRunning: matchData.isRunning || false,
                matchId: match.id
            };
            
            matchTimerData.set(match.id, timerData);
            
            // 타이머가 실행 중이었다면 시작 시간을 현재 시간 기준으로 조정
            if (timerData.isRunning) {
                const currentTime = Date.now();
                const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
                timerData.pausedTime = elapsedTime;
                timerData.startTime = currentTime - (timerData.pausedTime * 1000);
                matchTimerData.set(match.id, timerData);
            }
        }
        logger.info('독립 타이머 상태 복원 완료');
    } catch (error) {
        logger.error('타이머 복원 중 오류 발생:', error);
    }
}

// 헬스체크 엔드포인트 (배포 플랫폼용)
app.get('/health', async (req, res) => {
  try {
    // 데이터베이스 연결 확인
    await sequelize.authenticate();
    
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('헬스체크 실패:', error);
    res.status(503).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// 라우트 설정
app.get('/', requireAuth, (req, res) => {
  res.redirect('/matches');
});

// 경기 목록 페이지
app.get('/matches', requireAuth, async (req, res) => {
  try {
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
    
    // 사용자 목록 가져오기 (admin인 경우만)
    let users = [];
    if (req.session.userRole === 'admin') {
      users = await User.findAll({
        attributes: ['id', 'username', 'full_name'],
        where: { is_active: true }
      });
    } else {
      // 일반 사용자는 본인만
      users = [{
        id: req.session.userId,
        username: req.session.username,
        full_name: req.session.fullName || req.session.username
      }];
    }
    
    // 템플릿 기반 분류를 위해 Sport와 Template 정보 가져오기
    const sports = await Sport.findAll();
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
    
    logger.info(`경기 목록 조회 (사용자: ${req.session.username}, 권한: ${req.session.userRole}):`, matches.length + '개');
    res.render('matches', { 
      matches, 
      users, 
      userRole: req.session.userRole,
      sportTemplateMap 
    });
  } catch (error) {
    logger.error('경기 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 탭만 보는 페이지
app.get('/match-tabs', requireAuth, async (req, res) => {
  try {
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });
    
    // 모든 리스트 정보 가져오기
    const matchLists = await MatchList.findAll();
    
    // 각 매치가 어떤 리스트에 속하는지 확인
    const matchesWithListInfo = matches.map(match => {
      const matchData = match.toJSON();
      const listInfo = [];
      
      matchLists.forEach(list => {
        if (list.matches && Array.isArray(list.matches)) {
          const isInList = list.matches.some(listMatch => listMatch.id === match.id);
          if (isInList) {
            listInfo.push({
              id: list.id,
              name: list.name,
              custom_url: list.custom_url
            });
          }
        }
      });
      
      return {
        ...matchData,
        listInfo: listInfo,
        listIds: listInfo.map(list => list.id.toString()) // 문자열로 변환된 ID 배열 추가
      };
    });
    
    logger.info('탭 전용 페이지 조회:', matchesWithListInfo.length, '개 매치');
    res.render('match-tabs-only', { matches: matchesWithListInfo });
  } catch (error) {
    logger.error('탭 전용 페이지 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});



// 경기 생성 페이지
app.get('/matches/new', requireAuth, async (req, res) => {
  try {
    const sports = await Sport.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
    res.render('match-form', { sports });
  } catch (error) {
    logger.error('종목 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 생성 API
app.post('/api/match', requireAuth, async (req, res) => {
  try {
    const { sport_type, home_team, away_team, match_data, use_team_logos } = req.body;
    
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
    const defaultColors = await getDefaultTeamColors();
    if (!matchDataObj.home_team_color) matchDataObj.home_team_color = defaultColors.home;
    if (!matchDataObj.away_team_color) matchDataObj.away_team_color = defaultColors.away;

    // 타이머 관련 초기 데이터 추가
    matchDataObj = {
      ...matchDataObj,
      timer: 0,
      lastUpdateTime: Date.now(),
      isRunning: false
    };
    
    // 야구 경기인 경우, 팀 로고 자동 설정
    if (sport_type === 'baseball') {
      // 팀 로고 디렉토리 확인
      const logoDir = path.join(__dirname, 'public/TEAMLOGO/BASEBALL');
      
      try {
        // 팀별 로고 JSON 파일 경로
        const teamLogoMapPath = path.join(logoDir, 'team_logo_map.json');
        let teamLogoMap = {};
        
        // 팀 로고 매핑 파일이 존재하면 읽어오기
        if (fsSync.existsSync(teamLogoMapPath)) {
          teamLogoMap = JSON.parse(fsSync.readFileSync(teamLogoMapPath, 'utf8'));
        }
        
        // 홈팀 로고 찾기
        if (teamLogoMap[home_team]) {
          matchDataObj.home_team_logo = `/TEAMLOGO/BASEBALL/${teamLogoMap[home_team]}`;
          logger.info(`홈팀 로고 자동 설정: ${teamLogoMap[home_team]}`);
        }
        
        // 원정팀 로고 찾기
        if (teamLogoMap[away_team]) {
          matchDataObj.away_team_logo = `/TEAMLOGO/BASEBALL/${teamLogoMap[away_team]}`;
          logger.info(`원정팀 로고 자동 설정: ${teamLogoMap[away_team]}`);
        }
      } catch (error) {
        logger.error('팀 로고 자동 설정 오류:', error);
      }
    }

    const match = await Match.create({
      sport_type,
      home_team,
      away_team,
      match_data: matchDataObj,
      url,
      created_by: req.session.userId
    });

    // 타이머 초기화 (자동 시작하지 않음)
    // startMatchTimer(match.id); // 자동 타이머 시작 제거

    // 모든 종목에 대해 컨트롤러와 오버레이 URL 생성
    const overlay_url = `/${sport_type.toLowerCase()}/${match.id}/overlay`;
    const control_url = `/${sport_type.toLowerCase()}/${match.id}/control`;

    const matchData = match.toJSON();

    // 모든 종목에 대해 팀로고 사용 유무 설정 저장
    if (use_team_logos !== undefined) {
      try {
        // 모든 종목을 동일하게 처리 (종목별로 독립적인 설정)
        await Settings.upsert({
          key: `${sport_type.toLowerCase()}_team_logo_visibility_${match.id}`,
          value: use_team_logos.toString()
        });
        logger.info(`${sport_type} 경기 팀로고 사용 유무 설정 저장: ${match.id}, use_team_logos: ${use_team_logos}`);
      } catch (error) {
        logger.error('팀로고 사용 유무 설정 저장 오류:', error);
        // 설정 저장 실패해도 경기 생성은 계속 진행
      }
    }
    
    res.status(201).json({
      id: matchData.id,
      sport_type: matchData.sport_type,
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
      created_at: matchData.created_at,
      updated_at: matchData.updated_at,

      overlay_url,
      control_url
    });
  } catch (error) {
    logger.error('경기 생성 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 조회 API
app.get('/api/match/:id', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    res.json(match);
  } catch (error) {
    logger.error('경기 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 수정 API
app.put('/api/match/:id', async (req, res) => {
  try {
    const { sport_type, home_team, away_team, use_team_logos } = req.body;
    
    if (!sport_type || !home_team || !away_team) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }

    // 경기 정보 업데이트
    await match.update({
      sport_type,
      home_team,
      away_team
    });

    // 모든 종목에 대해 팀로고 사용 유무 설정 업데이트
    if (use_team_logos !== undefined) {
      try {
        // 모든 종목을 동일하게 처리 (종목별로 독립적인 설정)
        await Settings.upsert({
          key: `${sport_type.toLowerCase()}_team_logo_visibility_${req.params.id}`,
          value: use_team_logos.toString()
        });
        logger.info(`${sport_type} 경기 팀로고 사용 유무 설정 업데이트: ${req.params.id}, use_team_logos: ${use_team_logos}`);
      } catch (error) {
        logger.error('팀로고 사용 유무 설정 업데이트 오류:', error);
        // 설정 업데이트 실패해도 경기 수정은 계속 진행
      }
    }

    // 리스트에 등록된 경기 정보도 함께 업데이트
    const matchLists = await MatchList.findAll();
    let updatedLists = [];
    
    for (const list of matchLists) {
      if (list.matches && Array.isArray(list.matches)) {
        let updated = false;
        const updatedMatches = list.matches.map(listMatch => {
          if (listMatch.id === req.params.id) {
            updated = true;
            return {
              ...listMatch,
              sport_type,
              home_team,
              away_team
            };
          }
          return listMatch;
        });
        
        if (updated) {
          await list.update({ matches: updatedMatches });
          updatedLists.push(list.name);
          logger.info(`리스트 "${list.name}"의 경기 정보 업데이트 완료: ${req.params.id}`);
        }
      }
    }
    
    if (updatedLists.length > 0) {
      logger.info(`총 ${updatedLists.length}개 리스트에서 경기 정보 업데이트: ${updatedLists.join(', ')}`);
    }

    // 수정된 경기 정보를 모든 클라이언트에 브로드캐스트
    const updatedMatch = await Match.findByPk(req.params.id);
    io.emit('match_updated', {
      matchId: updatedMatch.id,
      sport_type: updatedMatch.sport_type,
      home_team: updatedMatch.home_team,
      away_team: updatedMatch.away_team,
      home_score: updatedMatch.home_score,
      away_score: updatedMatch.away_score,
      match_data: updatedMatch.match_data
    });

    logger.info(`경기 수정 완료: ${match.id} (${home_team} vs ${away_team})`);
    res.json(match);
  } catch (error) {
    logger.error('경기 수정 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 팀 로고 업로드 API
app.post('/api/team-logo', upload.single('logo'), async (req, res) => {
  try {
    // 디버깅을 위한 로그 추가
    logger.info(`팀 로고 업로드 요청: matchId=${req.body.matchId}, teamType=${req.body.teamType}, sportType=${req.body.sportType}`);
    
    // matchId와 teamType이 있는지 확인 (기본적인 보안)
    if (!req.body.matchId || !req.body.teamType) {
      logger.warn(`필수 파라미터 누락: matchId=${req.body.matchId}, teamType=${req.body.teamType}`);
      return res.status(400).json({ success: false, message: '필수 파라미터가 누락되었습니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    }

    // sportType 가져오기 (기본값: SOCCER)
    const sportType = req.body.sportType || 'SOCCER';
    
    // 원본 파일명을 안전하게 처리
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // 최종 저장 경로 설정
    const targetDir = path.join(__dirname, 'public', 'TEAMLOGO', sportType);
    const targetPath = path.join(targetDir, originalName);
    
    // 대상 디렉토리 생성
    if (!fsSync.existsSync(targetDir)) {
      fsSync.mkdirSync(targetDir, { recursive: true });
      logger.info(`디렉토리 생성됨: ${targetDir}`);
    }
    
    // 메모리에서 파일을 디스크에 저장
    await fs.writeFile(targetPath, req.file.buffer);
    
    // 파일이 올바르게 저장되었는지 확인
    if (!fsSync.existsSync(targetPath)) {
      logger.error(`파일 저장 실패: ${targetPath}`);
      return res.status(500).json({ 
        success: false, 
        message: '파일 저장에 실패했습니다.' 
      });
    }
    
    // 로고 파일 경로 생성 (public 폴더 기준 상대 경로)
    const logoPath = `/TEAMLOGO/${sportType}/${originalName}`;
    
    // match_data에 팀로고 정보 저장
    logger.info(`팀로고 업로드 요청 데이터: matchId=${req.body.matchId}, teamType=${req.body.teamType}, sportType=${sportType}`);
    
    if (req.body.matchId && req.body.teamType) {
      try {
        const match = await Match.findByPk(req.body.matchId);
        if (match) {
          const matchData = match.match_data || {};
          
          if (req.body.teamType === 'home') {
            matchData.home_team_logo = logoPath;
          } else if (req.body.teamType === 'away') {
            matchData.away_team_logo = logoPath;
          }
          
          match.match_data = matchData;
          await match.save();
          
          logger.info(`팀로고 정보가 match_data에 저장됨: ${req.body.matchId}, ${req.body.teamType}: ${logoPath}`);
          
          // team_logo_map.json 업데이트 (야구 경기인 경우)
          logger.info(`스포츠 타입 확인: ${match.sport_type}`);
          if (match.sport_type === 'BASEBALL' || match.sport_type === 'baseball') {
            logger.info('야구 경기이므로 team_logo_map.json 업데이트 시작');
            try {
              const logoMapPath = path.join(__dirname, 'public/TEAMLOGO/BASEBALL/team_logo_map.json');
              logger.info(`logoMapPath: ${logoMapPath}`);
              
              // 기존 파일 읽기
              let teamLogoMap = {};
              if (fsSync.existsSync(logoMapPath)) {
                const fileContent = await fs.readFile(logoMapPath, 'utf8');
                const parsed = JSON.parse(fileContent);
                teamLogoMap = parsed.teamLogoMap || {};
                logger.info(`기존 teamLogoMap 읽기 성공: ${Object.keys(teamLogoMap).length}개 팀`);
              } else {
                logger.warn('team_logo_map.json 파일이 존재하지 않음');
              }
              
              // 팀명 가져오기
              const teamName = req.body.teamType === 'home' ? match.home_team : match.away_team;
              logger.info(`업데이트할 팀명: ${teamName}, 팀 타입: ${req.body.teamType}`);
              
              // 팀 로고 정보 업데이트
              if (!teamLogoMap[teamName]) {
                teamLogoMap[teamName] = {};
                logger.info(`새 팀 엔트리 생성: ${teamName}`);
              }
              teamLogoMap[teamName].path = logoPath;
              teamLogoMap[teamName].name = teamName;
              if (!teamLogoMap[teamName].bgColor) {
                teamLogoMap[teamName].bgColor = '#ffffff';
              }
              
              logger.info(`팀 로고 정보 업데이트: ${teamName} -> ${logoPath}`);
              
              // 파일 저장
              const updatedData = {
                sport: 'BASEBALL',
                teamLogoMap: teamLogoMap
              };
              
              await fs.writeFile(logoMapPath, JSON.stringify(updatedData, null, 2), 'utf8');
              logger.info(`팀 로고 정보가 team_logo_map.json에 저장됨: ${teamName} -> ${logoPath}`);
            } catch (logoMapError) {
              logger.error('team_logo_map.json 업데이트 중 오류:', logoMapError);
            }
          } else {
            logger.info(`야구 경기가 아님: ${match.sport_type}`);
          }
        } else {
          logger.warn(`경기를 찾을 수 없음: ${req.body.matchId}`);
        }
      } catch (dbError) {
        logger.error('match_data 저장 중 오류:', dbError);
      }
    } else {
      logger.warn(`matchId 또는 teamType이 없음: matchId=${req.body.matchId}, teamType=${req.body.teamType}`);
    }
    
    res.json({ 
      success: true, 
      logoPath: logoPath,
      bgColor: '#ffffff', // 기본 배경색
      message: '로고가 성공적으로 업로드되었습니다.'
    });
    
    logger.info(`팀 로고 업로드 성공: ${logoPath}, 팀: ${req.body.teamName}, 타입: ${req.body.teamType}, 종목: ${sportType}`);
    logger.info(`실제 저장 경로: ${targetPath}`);
  } catch (error) {
    logger.error('로고 업로드 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기존 공통 오버레이 이미지 API들은 제거됨 (종목별 이미지로 대체)

// 기본 템플릿 목록 조회 API
app.get('/api/base-templates', async (req, res) => {
  try {
    const templateDir = path.join(__dirname, 'template');
    const viewsDir = path.join(__dirname, 'views');
    
    const templates = [];
    
    // 1. template 폴더의 기본 템플릿들
    if (fsSync.existsSync(templateDir)) {
      const templateFiles = fsSync.readdirSync(templateDir);
      const baseTemplates = templateFiles
        .filter(file => file.endsWith('-template.html'))
        .map(file => {
          const name = file.replace('-template.html', '');
          const displayName = name.charAt(0).toUpperCase() + name.slice(1);
          return {
            filename: file,
            name: name,
            displayName: displayName,
            path: `/template/${file}`,
            type: 'base'
          };
        });
      templates.push(...baseTemplates);
    }
    
    // 2. views 폴더의 기존 등록된 템플릿들 (soccer, baseball만 기본 템플릿으로 인식)
    if (fsSync.existsSync(viewsDir)) {
      const viewFiles = fsSync.readdirSync(viewsDir);
      const registeredTemplates = viewFiles
        .filter(file => {
          const name = file.replace('-template.ejs', '');
          // soccer와 baseball만 기본 템플릿으로 인식
          return file.endsWith('-template.ejs') && (name === 'soccer' || name === 'baseball');
        })
        .map(file => {
          const name = file.replace('-template.ejs', '');
          const displayName = name.charAt(0).toUpperCase() + name.slice(1);
          return {
            filename: file,
            name: name,
            displayName: displayName,
            path: `/views/${file}`,
            type: 'registered'
          };
        });
      templates.push(...registeredTemplates);
    }
    
    // 이름순으로 정렬
    templates.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    res.json({ success: true, templates: templates });
  } catch (error) {
    logger.error('기본 템플릿 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기본 템플릿 내용 조회 API
app.get('/api/base-template/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // template 폴더에서 먼저 찾기
    let templatePath = path.join(__dirname, 'template', filename);
    
    // template 폴더에 없으면 views 폴더에서 찾기
    if (!fsSync.existsSync(templatePath)) {
      templatePath = path.join(__dirname, 'views', filename);
    }
    
    if (!fsSync.existsSync(templatePath)) {
      return res.status(404).json({ success: false, message: '템플릿 파일을 찾을 수 없습니다.' });
    }
    
    const content = fsSync.readFileSync(templatePath, 'utf8');
    res.json({ success: true, content: content });
  } catch (error) {
    logger.error('기본 템플릿 내용 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 오버레이 이미지 업로드 API
app.post('/api/sport-overlay-image', sportOverlayImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    }

    const { sportCode } = req.body;
    if (!sportCode) {
      return res.status(400).json({ success: false, message: '종목 코드가 필요합니다.' });
    }

    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }

    // 이미지 파일 경로 생성 (public 폴더 기준 상대 경로)
    const imagePath = `/overlay-images/${sportCode}/${req.file.filename}`;
    
    // 데이터베이스에 저장
    await SportOverlayImage.create({
      sport_code: sportCode,
      filename: req.file.filename,
      file_path: imagePath,
      is_active: true
    });
    
    res.json({ 
      success: true, 
      imagePath: imagePath,
      filename: req.file.filename,
      sportCode: sportCode,
      message: '종목별 오버레이 이미지가 성공적으로 업로드되었습니다.'
    });
    
    // 해당 종목의 오버레이 페이지에 실시간으로 반영하기 위해 소켓 이벤트 발송
    io.emit('sport_overlay_image_updated', { 
      action: 'uploaded',
      sportCode: sportCode,
      imagePath: imagePath,
      filename: req.file.filename
    });
    
    logger.info(`종목별 오버레이 이미지 업로드 성공: ${sportCode} - ${imagePath}`);
  } catch (error) {
    logger.error('종목별 오버레이 이미지 업로드 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 오버레이 이미지 목록 조회 API
app.get('/api/sport-overlay-images/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 데이터베이스에서 해당 종목의 이미지 목록 조회
    const images = await SportOverlayImage.findAll({
      where: { sport_code: sportCode },
      order: [['upload_time', 'DESC']]
    });
    
    res.json({ success: true, images, sportName: sport.name });
  } catch (error) {
    logger.error('종목별 오버레이 이미지 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 오버레이 이미지 삭제 API
app.delete('/api/sport-overlay-image/:sportCode/:filename', async (req, res) => {
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
    const filePath = path.join(__dirname, 'public', 'overlay-images', sportCode, filename);
    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
    }
    
    // 데이터베이스에서 삭제
    await imageRecord.destroy();
    
    res.json({ 
      success: true, 
      message: '종목별 오버레이 이미지가 성공적으로 삭제되었습니다.'
    });
    
    // 해당 종목의 오버레이 페이지에 실시간으로 반영하기 위해 소켓 이벤트 발송
    io.emit('sport_overlay_image_updated', { 
      action: 'deleted',
      sportCode: sportCode,
      filename: filename
    });
    
    logger.info(`종목별 오버레이 이미지 삭제 성공: ${sportCode} - ${filename}`);
  } catch (error) {
    logger.error('종목별 오버레이 이미지 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 오버레이 이미지 활성화/비활성화 API
app.put('/api/sport-overlay-image/:sportCode/:filename/status', async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    const { isActive } = req.body;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 데이터베이스에서 이미지 정보 조회 및 업데이트
    const imageRecord = await SportOverlayImage.findOne({
      where: { sport_code: sportCode, filename: filename }
    });
    
    if (!imageRecord) {
      return res.status(404).json({ success: false, message: '이미지를 찾을 수 없습니다.' });
    }
    
    await imageRecord.update({ is_active: isActive });
    
    res.json({ 
      success: true, 
      message: `이미지가 ${isActive ? '활성화' : '비활성화'}되었습니다.`
    });
    
    logger.info(`종목별 오버레이 이미지 상태 변경: ${sportCode} - ${filename} - ${isActive}`);
  } catch (error) {
    logger.error('종목별 오버레이 이미지 상태 변경 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목 목록 조회 API
app.get('/api/sport', async (req, res) => {
  try {
    const sports = await Sport.findAll({
      where: { is_active: true },
      order: [['id', 'ASC']]
    });
    
    // 사용자 정보를 별도로 가져와서 매핑
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name']
    });
    
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });
    
    // sports에 creator 정보 추가
    const sportsWithCreators = sports.map(sport => {
      const sportData = sport.toJSON();
      sportData.creator = userMap[sportData.created_by] || null;
      return sportData;
    });
    
    res.json(sportsWithCreators);
  } catch (error) {
    logger.error('종목 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 현재 사용 중인 이미지 조회 API
app.get('/api/sport-active-overlay-image/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 현재 사용 중인 이미지 정보 조회
    const activeImage = await SportActiveOverlayImage.findOne({
      where: { sport_code: sportCode },
      include: [{
        model: SportOverlayImage,
        as: 'SportOverlayImage'
      }]
    });
    
    // 활성 이미지가 있고 파일이 실제로 존재하는지 확인
    let validActiveImage = null;
    if (activeImage && activeImage.active_image_path) {
      const filePath = path.join(__dirname, 'public', activeImage.active_image_path);
      if (fsSync.existsSync(filePath)) {
        validActiveImage = {
          id: activeImage.active_image_id,
          path: activeImage.active_image_path,
          filename: activeImage.SportOverlayImage ? activeImage.SportOverlayImage.filename : null
        };
      } else {
        // 파일이 존재하지 않으면 활성 이미지 정보를 null로 업데이트
        await activeImage.update({
          active_image_id: null,
          active_image_path: null
        });
        logger.warn(`활성 이미지 파일이 존재하지 않음: ${filePath}`);
      }
    }

    res.json({ 
      success: true, 
      activeImage: validActiveImage,
      sportName: sport.name
    });
  } catch (error) {
    logger.error('종목별 현재 사용 중인 이미지 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 현재 사용 중인 이미지 설정 API
app.post('/api/sport-active-overlay-image/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    const { imageId } = req.body;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 이미지가 존재하는지 확인
    if (imageId) {
      const image = await SportOverlayImage.findOne({
        where: { id: imageId, sport_code: sportCode }
      });
      if (!image) {
        return res.status(404).json({ success: false, message: '존재하지 않는 이미지입니다.' });
      }
    }
    
    // 이미지 정보 가져오기
    let image = null;
    if (imageId) {
      image = await SportOverlayImage.findOne({
        where: { id: imageId, sport_code: sportCode }
      });
      if (!image) {
        return res.status(404).json({ success: false, message: '존재하지 않는 이미지입니다.' });
      }
    }
    
    // 현재 사용 중인 이미지 정보 업데이트 또는 생성
    const [activeImage, created] = await SportActiveOverlayImage.findOrCreate({
      where: { sport_code: sportCode },
      defaults: {
        sport_code: sportCode,
        active_image_id: imageId,
        active_image_path: image ? image.file_path : null
      }
    });
    
    if (!created) {
      await activeImage.update({
        active_image_id: imageId,
        active_image_path: image ? image.file_path : null
      });
    }
    
    res.json({ 
      success: true, 
      message: '현재 사용 중인 이미지가 설정되었습니다.'
    });
    
    // 해당 종목의 오버레이 페이지에 실시간으로 반영하기 위해 소켓 이벤트 발송
    io.emit('sport_active_overlay_image_updated', { 
      sportCode: sportCode,
      imageId: imageId
    });
    
    logger.info(`종목별 현재 사용 중인 이미지 설정: ${sportCode} - ${imageId}`);
  } catch (error) {
    logger.error('종목별 현재 사용 중인 이미지 설정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 이미지 목록과 현재 사용 중인 이미지 함께 조회 API
app.get('/api/sport-overlay-images-with-active/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 해당 종목의 모든 이미지 목록 조회
    const images = await SportOverlayImage.findAll({
      where: { sport_code: sportCode },
      order: [['upload_time', 'DESC']]
    });
    
    // 현재 사용 중인 이미지 정보 조회
    const activeImage = await SportActiveOverlayImage.findOne({
      where: { sport_code: sportCode }
    });
    
    res.json({ 
      success: true, 
      images, 
      activeImageId: activeImage ? activeImage.active_image_id : null,
      sportName: sport.name 
    });
  } catch (error) {
    logger.error('종목별 이미지 목록과 현재 사용 중인 이미지 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오버레이 페이지용 종목별 현재 사용 중인 이미지 조회 API
app.get('/api/overlay-images/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 종목이 존재하는지 확인
    const sport = await Sport.findOne({ where: { code: sportCode } });
    if (!sport) {
      return res.status(404).json({ success: false, message: '존재하지 않는 종목입니다.' });
    }
    
    // 현재 사용 중인 이미지 정보 조회
    const activeImage = await SportActiveOverlayImage.findOne({
      where: { sport_code: sportCode },
      include: [{
        model: SportOverlayImage,
        as: 'SportOverlayImage'
      }]
    });
    
    if (activeImage && activeImage.SportOverlayImage) {
      res.json({ 
        success: true, 
        images: [{
          filename: activeImage.SportOverlayImage.filename,
          path: activeImage.SportOverlayImage.file_path,
          uploadTime: activeImage.SportOverlayImage.upload_time
        }]
      });
    } else {
      // 종목별 이미지가 없으면 기존 공통 이미지 반환
      const overlayImagesDir = path.join(__dirname, 'public', 'overlay-images');
      
      if (!fsSync.existsSync(overlayImagesDir)) {
        return res.json({ success: true, images: [] });
      }
      
      const files = fsSync.readdirSync(overlayImagesDir);
      const images = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        })
        .map(file => ({
          filename: file,
          path: `/overlay-images/${file}`,
          uploadTime: fsSync.statSync(path.join(overlayImagesDir, file)).mtime
        }))
        .sort((a, b) => b.uploadTime - a.uploadTime); // 최신순 정렬
      
      res.json({ success: true, images });
    }
  } catch (error) {
    logger.error('오버레이 페이지용 종목별 이미지 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 오버레이 디자인 설정 조회 API
app.get('/api/sport-overlay-design/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    const settings = await Settings.findAll();
    const settingsObj = {};
    
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    // 기본값 정의
    const defaultDesign = {
      scoreboard: { top: 140, left: 80 },
      homeLogo: { top: -120, left: 80 },
      awayLogo: { top: -120, right: 1420 },
      matchState: { top: 185, left: 230 },
      homeLineup: { top: 200, left: 80 },
      awayLineup: { top: 200, right: 50 },
      overlayImage: { top: 0, left: 0, width: 1920, height: 1080 },
      timer: { marginLeft: 8 }
    };
    
    // 종목별 설정 키 생성
    const sportCodeLower = sportCode.toLowerCase();
    
    // 저장된 설정이 있으면 사용, 없으면 기본값 사용
    const designSettings = {
      scoreboard: settingsObj[`${sportCodeLower}_scoreboard_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_scoreboard_position`]) : defaultDesign.scoreboard,
      homeLogo: settingsObj[`${sportCodeLower}_home_logo_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_home_logo_position`]) : defaultDesign.homeLogo,
      awayLogo: settingsObj[`${sportCodeLower}_away_logo_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_away_logo_position`]) : defaultDesign.awayLogo,
      matchState: settingsObj[`${sportCodeLower}_match_state_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_match_state_position`]) : defaultDesign.matchState,
      homeLineup: settingsObj[`${sportCodeLower}_home_lineup_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_home_lineup_position`]) : defaultDesign.homeLineup,
      awayLineup: settingsObj[`${sportCodeLower}_away_lineup_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_away_lineup_position`]) : defaultDesign.awayLineup,
      overlayImage: settingsObj[`${sportCodeLower}_overlay_image_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_overlay_image_position`]) : defaultDesign.overlayImage,
      timer: settingsObj[`${sportCodeLower}_timer_position`] ? JSON.parse(settingsObj[`${sportCodeLower}_timer_position`]) : defaultDesign.timer
    };
    
    res.json({ success: true, design: designSettings, default: defaultDesign });
  } catch (error) {
    logger.error(`${sportCode} 오버레이 디자인 설정 조회 오류:`, error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 축구 오버레이 디자인 설정 조회 API (기존 호환성 유지)
app.get('/api/soccer-overlay-design', async (req, res) => {
  try {
    const settings = await Settings.findAll();
    const settingsObj = {};
    
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
         // 기본값 정의
     const defaultDesign = {
       scoreboard: { top: 140, left: 80 },
       homeLogo: { top: -120, left: 80 },
       awayLogo: { top: -120, right: 1420 },
       matchState: { top: 185, left: 230 },
       homeLineup: { top: 200, left: 80 },
       awayLineup: { top: 200, right: 50 },
       overlayImage: { top: 0, left: 0, width: 1920, height: 1080 },
       timer: { marginLeft: 8 }
     };
    
    // 저장된 설정이 있으면 사용, 없으면 기본값 사용
    const designSettings = {
      scoreboard: settingsObj.soccer_scoreboard_position ? JSON.parse(settingsObj.soccer_scoreboard_position) : defaultDesign.scoreboard,
      homeLogo: settingsObj.soccer_home_logo_position ? JSON.parse(settingsObj.soccer_home_logo_position) : defaultDesign.homeLogo,
      awayLogo: settingsObj.soccer_away_logo_position ? JSON.parse(settingsObj.soccer_away_logo_position) : defaultDesign.awayLogo,
      matchState: settingsObj.soccer_match_state_position ? JSON.parse(settingsObj.soccer_match_state_position) : defaultDesign.matchState,
      homeLineup: settingsObj.soccer_home_lineup_position ? JSON.parse(settingsObj.soccer_home_lineup_position) : defaultDesign.homeLineup,
      awayLineup: settingsObj.soccer_away_lineup_position ? JSON.parse(settingsObj.soccer_away_lineup_position) : defaultDesign.awayLineup,
      overlayImage: settingsObj.soccer_overlay_image_position ? JSON.parse(settingsObj.soccer_overlay_image_position) : defaultDesign.overlayImage,
      timer: settingsObj.soccer_timer_position ? JSON.parse(settingsObj.soccer_timer_position) : defaultDesign.timer
    };
    
    res.json({ success: true, design: designSettings, default: defaultDesign });
  } catch (error) {
    logger.error('축구 오버레이 디자인 설정 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종목별 오버레이 디자인 설정 저장 API
app.post('/api/sport-overlay-design/:sportCode', async (req, res) => {
  try {
    const { sportCode } = req.params;
    const { design } = req.body;
    
    const sportCodeLower = sportCode.toLowerCase();
    
    // 각 요소별로 설정 저장
    const settingsToSave = [
      { key: `${sportCodeLower}_scoreboard_position`, value: JSON.stringify(design.scoreboard) },
      { key: `${sportCodeLower}_home_logo_position`, value: JSON.stringify(design.homeLogo) },
      { key: `${sportCodeLower}_away_logo_position`, value: JSON.stringify(design.awayLogo) },
      { key: `${sportCodeLower}_match_state_position`, value: JSON.stringify(design.matchState) },
      { key: `${sportCodeLower}_home_lineup_position`, value: JSON.stringify(design.homeLineup) },
      { key: `${sportCodeLower}_away_lineup_position`, value: JSON.stringify(design.awayLineup) },
      { key: `${sportCodeLower}_overlay_image_position`, value: JSON.stringify(design.overlayImage) },
      { key: `${sportCodeLower}_timer_position`, value: JSON.stringify(design.timer) }
    ];
    
    for (const setting of settingsToSave) {
      await Settings.upsert({
        key: setting.key,
        value: setting.value
      });
    }
    
    res.json({ 
      success: true, 
      message: `${sportCode} 오버레이 디자인 설정이 저장되었습니다.`
    });
    
    logger.info(`${sportCode} 오버레이 디자인 설정 저장 완료`);
  } catch (error) {
    logger.error(`${sportCode} 오버레이 디자인 설정 저장 오류:`, error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 축구 오버레이 디자인 설정 저장 API (기존 호환성 유지)
app.post('/api/soccer-overlay-design', async (req, res) => {
  try {
    const { design } = req.body;
    
    // 각 요소별로 설정 저장
    const settingsToSave = [
      { key: 'soccer_scoreboard_position', value: JSON.stringify(design.scoreboard) },
      { key: 'soccer_home_logo_position', value: JSON.stringify(design.homeLogo) },
      { key: 'soccer_away_logo_position', value: JSON.stringify(design.awayLogo) },
      { key: 'soccer_match_state_position', value: JSON.stringify(design.matchState) },
      { key: 'soccer_home_lineup_position', value: JSON.stringify(design.homeLineup) },
      { key: 'soccer_away_lineup_position', value: JSON.stringify(design.awayLineup) },
      { key: 'soccer_overlay_image_position', value: JSON.stringify(design.overlayImage) },
      { key: 'soccer_timer_position', value: JSON.stringify(design.timer) }
    ];
    
    for (const setting of settingsToSave) {
      await Settings.upsert({
        key: setting.key,
        value: setting.value
      });
    }
    
    res.json({ 
      success: true, 
      message: '축구 오버레이 디자인 설정이 저장되었습니다.'
    });
    
    logger.info('축구 오버레이 디자인 설정 저장 완료');
  } catch (error) {
    logger.error('축구 오버레이 디자인 설정 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 축구 오버레이 디자인 설정 초기화 API
app.post('/api/soccer-overlay-design/reset', async (req, res) => {
  try {
    // 기본값으로 설정 키들 삭제
    const keysToDelete = [
      'soccer_scoreboard_position',
      'soccer_home_logo_position',
      'soccer_away_logo_position',
      'soccer_match_state_position',
      'soccer_home_lineup_position',
      'soccer_away_lineup_position',
      'soccer_overlay_image_position',
      'soccer_timer_position'
    ];
    
    for (const key of keysToDelete) {
      await Settings.destroy({
        where: { key: key }
      });
    }
    
    res.json({ 
      success: true, 
      message: '축구 오버레이 디자인 설정이 기본값으로 초기화되었습니다.'
    });
    
    logger.info('축구 오버레이 디자인 설정 초기화 완료');
  } catch (error) {
    logger.error('축구 오버레이 디자인 설정 초기화 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 축구 경기 상태 표시 설정 조회 API
app.get('/api/soccer-match-state-visibility', async (req, res) => {
  try {
    const setting = await Settings.findOne({
      where: { key: 'soccer_match_state_visibility' }
    });
    
    const showMatchState = setting ? setting.value === 'true' : true; // 기본값은 true (표시)
    
    res.json({ 
      success: true, 
      showMatchState: showMatchState 
    });
  } catch (error) {
    logger.error('축구 경기 상태 표시 설정 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 축구 경기 상태 표시 설정 저장 API
app.post('/api/soccer-match-state-visibility', async (req, res) => {
  try {
    const { showMatchState } = req.body;
    
    await Settings.upsert({
      key: 'soccer_match_state_visibility',
      value: showMatchState.toString()
    });
    
    // 모든 축구 오버레이 페이지에 실시간으로 반영하기 위해 소켓 이벤트 발송
    io.emit('soccer_match_state_visibility_changed', { showMatchState: showMatchState });
    
    res.json({ 
      success: true, 
      message: '경기 상태 표시 설정이 저장되었습니다.'
    });
    
    logger.info(`축구 경기 상태 표시 설정 저장 완료: ${showMatchState}`);
  } catch (error) {
    logger.error('축구 경기 상태 표시 설정 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 팀로고 사용 상태 저장 API (모든 종목 지원)
app.post('/api/team-logo-visibility', async (req, res) => {
  try {
    const { matchId, sportType, useLogos } = req.body;
    
    if (!matchId || !sportType) {
      return res.status(400).json({ 
        success: false, 
        error: 'matchId와 sportType이 필요합니다.' 
      });
    }
    
    // 모든 종목을 동일하게 처리 (종목별로 독립적인 설정)
    await Settings.upsert({
      key: `${sportType.toLowerCase()}_team_logo_visibility_${matchId}`,
      value: useLogos.toString()
    });
    
    // 해당 매치룸의 모든 클라이언트에게 실시간으로 반영
    io.to(`match_${matchId}`).emit('teamLogoVisibilityChanged', {
      matchId: matchId,
      useLogos: useLogos
    });
    
    res.json({ 
      success: true, 
      message: '팀로고 사용 상태가 저장되었습니다.'
    });
    
    logger.info(`${sportType} 팀로고 사용 상태 저장 완료: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('팀로고 사용 상태 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 팀로고 사용 상태 불러오기 API (모든 종목 지원)
app.get('/api/team-logo-visibility/:sportType/:matchId', async (req, res) => {
  try {
    const { sportType, matchId } = req.params;
    
    // 모든 종목을 동일하게 처리 (종목별로 독립적인 설정)
    const setting = await Settings.findOne({
      where: { key: `${sportType.toLowerCase()}_team_logo_visibility_${matchId}` }
    });
    
    const useLogos = setting ? setting.value === 'true' : true; // 기본값은 true
    
    res.json({ 
      success: true, 
      useLogos: useLogos
    });
    
    logger.info(`${sportType} 팀로고 사용 상태 불러오기: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('팀로고 사용 상태 불러오기 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기존 축구 전용 API (호환성 유지)
app.post('/api/soccer-team-logo-visibility', async (req, res) => {
  try {
    const { matchId, useLogos } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ 
        success: false, 
        error: 'matchId가 필요합니다.' 
      });
    }
    
    await Settings.upsert({
      key: `soccer_team_logo_visibility_${matchId}`,
      value: useLogos.toString()
    });
    
    // 해당 매치룸의 모든 클라이언트에게 실시간으로 반영
    io.to(`match_${matchId}`).emit('teamLogoVisibilityChanged', {
      matchId: matchId,
      useLogos: useLogos
    });
    
    res.json({ 
      success: true, 
      message: '팀로고 사용 상태가 저장되었습니다.'
    });
    
    logger.info(`팀로고 사용 상태 저장 완료: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('팀로고 사용 상태 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기존 축구 전용 API (호환성 유지)
app.get('/api/soccer-team-logo-visibility/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const setting = await Settings.findOne({
      where: { key: `soccer_team_logo_visibility_${matchId}` }
    });
    
    const useLogos = setting ? setting.value === 'true' : true; // 기본값은 true
    
    res.json({ 
      success: true, 
      useLogos: useLogos
    });
    
    logger.info(`팀로고 사용 상태 불러오기: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('팀로고 사용 상태 불러오기 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// KT Soccer 팀로고 사용 상태 저장 API
app.post('/api/kt_soccer-team-logo-visibility', async (req, res) => {
  try {
    const { matchId, useLogos } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ 
        success: false, 
        error: 'matchId가 필요합니다.' 
      });
    }
    
    await Settings.upsert({
      key: `kt_soccer_team_logo_visibility_${matchId}`,
      value: useLogos.toString()
    });
    
    // 해당 매치룸의 모든 클라이언트에게 실시간으로 반영
    io.to(`match_${matchId}`).emit('teamLogoVisibilityChanged', {
      matchId: matchId,
      useLogos: useLogos
    });
    
    res.json({ 
      success: true, 
      message: '팀로고 사용 상태가 저장되었습니다.'
    });
    
    logger.info(`KT Soccer 팀로고 사용 상태 저장 완료: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('KT Soccer 팀로고 사용 상태 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// KT Soccer 팀로고 사용 상태 조회 API
app.get('/api/kt_soccer-team-logo-visibility/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const setting = await Settings.findOne({
      where: { key: `kt_soccer_team_logo_visibility_${matchId}` }
    });
    
    const useLogos = setting ? setting.value === 'true' : true; // 기본값은 true
    
    res.json({ 
      success: true, 
      useLogos: useLogos
    });
    
    logger.info(`KT Soccer 팀로고 사용 상태 불러오기: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('KT Soccer 팀로고 사용 상태 불러오기 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Baseball 팀로고 사용 상태 저장 API
app.post('/api/baseball-team-logo-visibility', async (req, res) => {
  try {
    const { matchId, useLogos } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ 
        success: false, 
        error: 'matchId가 필요합니다.' 
      });
    }
    
    await Settings.upsert({
      key: `baseball_team_logo_visibility_${matchId}`,
      value: useLogos.toString()
    });
    
    // 해당 매치룸의 모든 클라이언트에게 실시간으로 반영
    io.to(`match_${matchId}`).emit('teamLogoVisibilityChanged', {
      matchId: matchId,
      useLogos: useLogos
    });
    
    res.json({ 
      success: true, 
      message: '팀로고 사용 상태가 저장되었습니다.'
    });
    
    logger.info(`Baseball 팀로고 사용 상태 저장 완료: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('Baseball 팀로고 사용 상태 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '팀로고 사용 상태 저장에 실패했습니다.' 
    });
  }
});

// Baseball 팀로고 사용 상태 조회 API
app.get('/api/baseball-team-logo-visibility/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const setting = await Settings.findOne({
      where: { key: `baseball_team_logo_visibility_${matchId}` }
    });
    
    const useLogos = setting ? setting.value === 'true' : true; // 기본값은 true
    
    res.json({ 
      success: true, 
      useLogos: useLogos 
    });
    
    logger.info(`Baseball 팀로고 사용 상태 조회: ${matchId}, useLogos: ${useLogos}`);
  } catch (error) {
    logger.error('Baseball 팀로고 사용 상태 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '팀로고 사용 상태 조회에 실패했습니다.' 
    });
  }
});

// 추가 박스 텍스트 저장 API
app.post('/api/extra-box-text', async (req, res) => {
  try {
    const { matchId, sportType, text } = req.body;
    
    if (!matchId || !sportType) {
      return res.status(400).json({ 
        success: false, 
        error: 'matchId와 sportType이 필요합니다.' 
      });
    }
    
    await Settings.upsert({
      key: `${sportType.toLowerCase()}_extra_box_text_${matchId}`,
      value: text || '0 (승부차기) 0'
    });
    
    res.json({ 
      success: true, 
      message: '추가 박스 텍스트가 저장되었습니다.'
    });
    
    logger.info(`추가 박스 텍스트 저장 완료: ${matchId}, text: ${text}`);
  } catch (error) {
    logger.error('추가 박스 텍스트 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 추가 박스 텍스트 조회 API
app.get('/api/extra-box-text/:sportType/:matchId', async (req, res) => {
  try {
    const { sportType, matchId } = req.params;
    
    const setting = await Settings.findOne({
      where: {
        key: `${sportType.toLowerCase()}_extra_box_text_${matchId}`
      }
    });
    
    const text = setting ? setting.value : '0 (승부차기) 0';
    
    res.json({ 
      success: true, 
      text: text
    });
    
    logger.info(`추가 박스 텍스트 조회: ${matchId}, text: ${text}`);
  } catch (error) {
    logger.error('추가 박스 텍스트 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오버레이 URL 상태 확인 API
app.get('/api/overlay-status/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    
    // 현재 푸시된 경기 정보 확인
    const pushedMatch = pushedMatches.get(listId);
    
    if (!pushedMatch) {
      return res.json({ 
        success: true, 
        isActive: false,
        message: '푸시된 경기가 없습니다.'
      });
    }
    
    // 경기 정보 가져오기
    const match = await Match.findByPk(pushedMatch.matchId);
    if (!match) {
      // 경기가 삭제된 경우 푸시 정보도 삭제
      pushedMatches.delete(listId);
      return res.json({ 
        success: true, 
        isActive: false,
        message: '푸시된 경기가 삭제되었습니다.'
      });
    }
    
    // URL 상태 정보 반환
    res.json({ 
      success: true, 
      isActive: true,
      matchId: pushedMatch.matchId,
      matchIndex: pushedMatch.matchIndex,
      timestamp: pushedMatch.timestamp,
      match: {
        id: match.id,
        sport_type: match.sport_type,
        home_team: match.home_team,
        away_team: match.away_team,
        home_score: match.home_score,
        away_score: match.away_score
      },
      overlayUrl: `/unified/${listId}/overlay`,
      message: '오버레이 URL이 활성 상태입니다.'
    });
    
  } catch (error) {
    logger.error('오버레이 URL 상태 확인 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오버레이 URL 강제 새로고침 API
app.post('/api/overlay-refresh/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    
    logger.info(`=== 오버레이 강제 새로고침 요청 ===`);
    logger.info(`listId: ${listId}`);
    
    // 기존 푸시 정보 삭제
    pushedMatches.delete(listId);
    logger.info(`기존 푸시 정보 삭제 완료: ${listId}`);
    
    // 방 정보 확인
    const roomName = `list_overlay_${listId}`;
    const room = io.sockets.adapter.rooms.get(roomName);
    const connectedClients = room ? room.size : 0;
    
    logger.info(`방 정보: ${roomName}, 연결된 클라이언트 수: ${connectedClients}`);
    
    // 모든 리스트 오버레이 클라이언트에게 새로고침 알림
    io.to(roomName).emit('overlay_force_refresh', { 
      listId: listId,
      timestamp: Date.now()
    });
    
    logger.info(`강제 새로고침 이벤트 전송 완료: ${roomName}`);
    
    res.json({ 
      success: true, 
      message: '오버레이 URL이 강제 새로고침되었습니다.',
      connectedClients: connectedClients
    });
    
    logger.info(`오버레이 URL 강제 새로고침 완료: ${listId}`);
  } catch (error) {
    logger.error('오버레이 URL 강제 새로고침 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// CSV 일괄 등록 API
app.post('/api/bulk-create-matches', csvUpload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV 파일이 없습니다.' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV 파일이 비어있거나 헤더만 있습니다.' });
    }

    // 헤더 확인
    const header = lines[0].split(',').map(col => col.trim());
    if (header.length < 3) {
      return res.status(400).json({ error: 'CSV 형식이 올바르지 않습니다. 형식: 리스트명,홈팀명,어웨이팀명' });
    }

    let createdMatches = 0;
    let createdLists = 0;
    let updatedLists = 0;
    const processedLists = new Set();
    const successRows = [];
    const errors = [];

    // 각 행을 순차적으로 처리
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',').map(col => col.trim());
      if (columns.length < 3) {
        logger.warn(`행 ${i + 1}: 컬럼 수가 부족합니다. 건너뜁니다.`);
        errors.push(`행 ${i + 1}: 컬럼 수가 부족합니다.`);
        continue;
      }

      const [listName, homeTeam, awayTeam] = columns;

      try {
        logger.info(`행 ${i + 1} 처리 시작: ${listName} - ${homeTeam} vs ${awayTeam}`);
        
        // 리스트 찾기 또는 생성 (트랜잭션 내에서)
        let list = await MatchList.findOne({ 
          where: { name: listName }
        });
        let isNewList = false;

        if (!list) {
          logger.info(`새 리스트 생성: ${listName}`);
          list = await MatchList.create({
            name: listName,
            matches: []
          });
          createdLists++;
          isNewList = true;
          logger.info(`리스트 생성 완료: ${listName} (ID: ${list.id})`);
        } else {
          logger.info(`기존 리스트 사용: ${listName} (ID: ${list.id})`);
        }

        // 고유한 경기 ID 생성
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateCode = `${month}${day}`;
        const sportCode = 'SC'; // 축구
        
        // 중복되지 않는 ID 생성
        let uniqueId;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
          const timestamp = Date.now() + attempts;
          const sequence = String(timestamp % 10000).padStart(4, '0');
          uniqueId = `${dateCode}${sportCode}${sequence}`;
          attempts++;
          
          // 기존 ID 확인
          const existingMatch = await Match.findByPk(uniqueId);
          if (!existingMatch) break;
          
          if (attempts >= maxAttempts) {
            throw new Error('고유한 경기 ID를 생성할 수 없습니다.');
          }
        } while (true);
        
        // 경기 생성 (트랜잭션 내에서)
        logger.info(`경기 생성 시작: ${homeTeam} vs ${awayTeam} (ID: ${uniqueId})`);
        const match = await Match.create({
          id: uniqueId,
          sport_type: 'soccer', // 기본값으로 축구 설정
          home_team: homeTeam,
          away_team: awayTeam,
          home_score: 0,
          away_score: 0,
          status: 'pending',
          match_data: {
            state: '경기 전',
            home_shots: 0,
            away_shots: 0,
            home_shots_on_target: 0,
            away_shots_on_target: 0,
            home_corners: 0,
            away_corners: 0,
            home_fouls: 0,
            away_fouls: 0,
            timer: 0,
            lastUpdateTime: Date.now(),
            isRunning: false
          }
        });
        logger.info(`경기 생성 완료: ${match.id} (${homeTeam} vs ${awayTeam})`);

        // 리스트에 경기 추가 (트랜잭션 내에서)
        logger.info(`리스트에 경기 추가 시작: ${listName}`);
        const currentMatches = list.matches || [];
        const matchInfo = {
          id: match.id,
          sport_type: match.sport_type,
          home_team: match.home_team,
          away_team: match.away_team,
          home_score: match.home_score,
          away_score: match.away_score
        };
        
        // 중복 체크
        if (!currentMatches.some(m => m.id === match.id)) {
          currentMatches.push(matchInfo);
          
          logger.info(`리스트 업데이트 전: ${listName}, 경기 수: ${currentMatches.length}`);
          logger.info(`추가할 경기 정보:`, matchInfo);
          
          // 리스트 새로고침 후 업데이트
          const freshList = await MatchList.findByPk(list.id);
          await freshList.update({ matches: currentMatches });
          
          // 업데이트 확인
          const updatedList = await MatchList.findByPk(list.id);
          logger.info(`리스트 업데이트 후: ${updatedList.name}, 경기 수: ${updatedList.matches ? updatedList.matches.length : 0}`);
          
          createdMatches++;
          successRows.push(`행 ${i + 1}: ${listName} - ${homeTeam} vs ${awayTeam} (ID: ${match.id})`);

          if (!isNewList && !processedLists.has(list.id)) {
            updatedLists++;
            processedLists.add(list.id);
          }

          logger.info(`경기 생성 및 리스트 추가 완료: ${match.id} (${homeTeam} vs ${awayTeam}) -> 리스트: ${listName}`);
        } else {
          logger.info(`경기 ${match.id}는 이미 리스트 ${listName}에 존재합니다.`);
          successRows.push(`행 ${i + 1}: ${listName} - ${homeTeam} vs ${awayTeam} (이미 존재)`);
        }

        // 각 행 처리 후 잠시 대기 (데이터베이스 안정화)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        logger.error(`행 ${i + 1} 처리 중 오류:`, error);
        errors.push(`행 ${i + 1}: ${listName} - ${homeTeam} vs ${awayTeam} - ${error.message}`);
        // 개별 행 오류는 로그만 남기고 계속 진행
      }
    }

    // 처리 완료 후 리스트 상태 확인
    logger.info('=== 처리 완료 후 리스트 상태 확인 ===');
    const allLists = await MatchList.findAll();
    for (const list of allLists) {
      logger.info(`리스트 "${list.name}": ${list.matches ? list.matches.length : 0}개 경기`);
      if (list.matches && list.matches.length > 0) {
        logger.info(`  경기 목록: ${list.matches.map(m => `${m.home_team} vs ${m.away_team} (${m.id})`).join(', ')}`);
      }
    }
    
    logger.info(`CSV 일괄 등록 완료: 경기 ${createdMatches}개, 새 리스트 ${createdLists}개, 업데이트된 리스트 ${updatedLists}개`);
    logger.info(`성공한 행: ${successRows.length}개, 실패한 행: ${errors.length}개`);
    
    res.json({
      success: true,
      createdMatches,
      createdLists,
      updatedLists,
      successRows,
      errors,
      message: 'CSV 일괄 등록이 완료되었습니다.'
    });

  } catch (error) {
    logger.error('CSV 일괄 등록 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 팀 로고 매핑 JSON 업데이트 API
app.post('/api/update-team-logo-map', async (req, res) => {
  try {
    const { sportType, teamLogoMap, teamName, logoPath, logoName } = req.body;
    
    if (!sportType) {
      return res.status(400).json({ error: 'sportType이 필요합니다.' });
    }

    // 종목별 디렉토리 생성
    const logoDir = path.join(__dirname, 'public/TEAMLOGO', sportType);
    if (!fsSync.existsSync(logoDir)) {
      fsSync.mkdirSync(logoDir, { recursive: true });
    }

    const logoMapPath = path.join(logoDir, 'team_logo_map.json');
    
    // 기존 파일 읽기
    let existingData = { sport: sportType, teamLogoMap: {} };
    try {
      if (fsSync.existsSync(logoMapPath)) {
        const fileContent = await fs.readFile(logoMapPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        
        // 중첩 구조 정리: teamLogoMap이 중첩되어 있으면 최상위 teamLogoMap만 사용
        if (parsed.teamLogoMap && typeof parsed.teamLogoMap === 'object') {
          // teamLogoMap 안에 또 teamLogoMap이 있는지 확인
          if (parsed.teamLogoMap.teamLogoMap) {
            existingData.teamLogoMap = parsed.teamLogoMap.teamLogoMap;
          } else {
            existingData.teamLogoMap = parsed.teamLogoMap;
          }
        }
      }
    } catch (readError) {
      logger.warn('기존 team_logo_map.json 파일 읽기 실패, 새로 생성합니다:', readError.message);
    }

    // 새로운 데이터 처리
    if (teamLogoMap && typeof teamLogoMap === 'object') {
      // 전체 teamLogoMap이 전달된 경우
      existingData.teamLogoMap = teamLogoMap;
    } else if (teamName && logoPath) {
      // 개별 팀 로고 정보가 전달된 경우
      if (!existingData.teamLogoMap[teamName]) {
        existingData.teamLogoMap[teamName] = {};
      }
      existingData.teamLogoMap[teamName].path = logoPath;
      if (logoName) {
        existingData.teamLogoMap[teamName].name = logoName;
      }
    }

    // JSON 파일 저장
    await fs.writeFile(logoMapPath, JSON.stringify(existingData, null, 2), 'utf8');

    logger.info(`${sportType} 팀 로고 매핑 데이터가 업데이트되었습니다.`);
    res.json({
      success: true,
      message: '팀 로고 매핑 데이터가 성공적으로 업데이트되었습니다.'
    });
  } catch (error) {
    logger.error('팀 로고 매핑 업데이트 중 오류 발생:', error);
    res.status(500).json({
      error: '팀 로고 매핑 업데이트 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    logger.info('클라이언트 연결됨');

    // 모든 방에서 나가기
    socket.on('leave_all_rooms', () => {
        // 클라이언트가 참가한 모든 방에서 나가기
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) { // 기본 소켓 ID 방은 제외
                socket.leave(room);
                logger.info(`클라이언트 ${socket.id}가 방 ${room}에서 나감`);
            }
        });
    });

    // join 이벤트 처리 (중복 제거됨)

    // 타이머 상태 요청 이벤트 처리
    socket.on('request_timer_state', async (data) => {
        try {
            const { matchId } = data;
            logger.info(`타이머 상태 요청: matchId=${matchId}`);
            
            // 메모리에서 타이머 데이터 가져오기
            let timerData = matchTimerData.get(matchId);
            
            if (!timerData) {
                // 메모리에 없으면 DB에서 복원
                const match = await Match.findByPk(matchId);
                if (match) {
                    const matchData = match.match_data || {};
                    timerData = {
                        startTime: matchData.timer_startTime || Date.now(),
                        pausedTime: matchData.timer_pausedTime || 0,
                        isRunning: matchData.isRunning || false,
                        matchId: matchId
                    };
                    matchTimerData.set(matchId, timerData);
                } else {
                    throw new Error('경기를 찾을 수 없습니다.');
                }
            }
            
            // 현재 시간 계산
            let currentSeconds = timerData.pausedTime;
            if (timerData.isRunning) {
                const currentTime = Date.now();
                const elapsedTime = Math.floor((currentTime - timerData.startTime) / 1000);
                currentSeconds = timerData.pausedTime + elapsedTime;
            }
            
            // 클라이언트에게 현재 타이머 상태 전송
            const responseData = {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: timerData.isRunning,
                startTime: timerData.startTime,
                pausedTime: timerData.pausedTime,
                minute: Math.floor(currentSeconds / 60),
                second: currentSeconds % 60,
                lastUpdateTime: Date.now()
            };
            
            socket.emit('timer_state', responseData);
            
            logger.info(`타이머 상태 전송 완료: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${timerData.isRunning}`);
        } catch (error) {
            logger.error('타이머 상태 요청 처리 중 오류 발생:', error);
        }
    });

    // 리스트 오버레이 join 이벤트 처리
    socket.on('join_list_overlay', (listId) => {
        const roomName = `list_overlay_${listId}`;
        socket.join(roomName);
        logger.info(`클라이언트 ${socket.id}가 리스트 오버레이 방 ${roomName}에 참가함`);
    });

    // 경기 업데이트 이벤트 처리 (점수, 상태 등)
    socket.on('match_updated', async (data) => {
        try {
            const { matchId, home_score, away_score, state } = data;
            logger.info(`경기 업데이트: matchId=${matchId}, home_score=${home_score}, away_score=${away_score}, state=${state}`);
            
            // 해당 경기의 모든 클라이언트에게 업데이트 전송
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('match_data_updated', {
                matchId: matchId,
                home_score: home_score,
                away_score: away_score,
                state: state
            });
            
            // 리스트 오버레이에도 업데이트 전송 (해당 경기가 현재 표시 중인 경우)
            // 모든 리스트 오버레이 방에 업데이트 전송
            const rooms = Array.from(io.sockets.adapter.rooms.keys()).filter(room => room.startsWith('list_overlay_'));
            rooms.forEach(room => {
                io.to(room).emit('match_data_updated', {
                    matchId: matchId,
                    home_score: home_score,
                    away_score: away_score,
                    state: state
                });
            });
            
        } catch (error) {
            logger.error('match_updated 이벤트 처리 중 오류 발생:', error);
        }
    });

    // 타이머 제어 이벤트 처리
    socket.on('timer_control', async (data) => {
        try {
            const { matchId, action, minutes, seconds, currentTime } = data;
            logger.info(`타이머 제어: matchId=${matchId}, action=${action}, minutes=${minutes}, seconds=${seconds}, currentTime=${currentTime}`);
            
            // 경기 데이터 업데이트
            const match = await Match.findByPk(matchId);
            if (!match) {
                throw new Error('경기를 찾을 수 없습니다.');
            }
            
            const matchData = match.match_data || {};
            let timerData = {};
            
            if (action === 'set') {
                matchData.minute = minutes;
                matchData.second = seconds;
                matchData.timer = minutes * 60 + seconds;
                matchData.currentSeconds = minutes * 60 + seconds;
                timerData = {
                    matchId: matchId,
                    minute: minutes,
                    second: seconds,
                    timer: minutes * 60 + seconds,
                    currentSeconds: minutes * 60 + seconds
                };
                
                // 서버 측 타이머 설정 (현재 시간으로 설정)
                setMatchTimer(matchId, minutes, seconds);
            } else if (action === 'start') {
                matchData.isRunning = true;
                // 현재 타이머 값을 유지하면서 시작
                const currentSeconds = matchData.currentSeconds || matchData.timer || 0;
                matchData.currentSeconds = currentSeconds;
                timerData = {
                    matchId: matchId,
                    isRunning: true,
                    currentSeconds: currentSeconds,
                    timer: currentSeconds,
                    minute: Math.floor(currentSeconds / 60),
                    second: currentSeconds % 60
                };
                
                // 서버 측 타이머 시작 (현재 시간으로 설정)
                let timer = matchTimerData.get(matchId);
                if (!timer) {
                    startMatchTimer(matchId);
                    timer = matchTimerData.get(matchId);
                }
                // 기존 방식 호환성은 새로운 타이머 데이터에서 관리됨
            } else if (action === 'stop') {
                matchData.isRunning = false;
                // 클라이언트에서 전송된 현재 시간을 사용
                const currentSeconds = currentTime || matchData.currentSeconds || matchData.timer || 0;
                matchData.currentSeconds = currentSeconds;
                matchData.timer = currentSeconds;
                matchData.minute = Math.floor(currentSeconds / 60);
                matchData.second = currentSeconds % 60;
                timerData = {
                    matchId: matchId,
                    isRunning: false,
                    currentSeconds: currentSeconds,
                    timer: currentSeconds,
                    minute: Math.floor(currentSeconds / 60),
                    second: currentSeconds % 60
                };
                
                // 서버 측 타이머 정지 (클라이언트 시간 사용)
                stopMatchTimer(matchId, currentSeconds);
            } else if (action === 'reset') {
                matchData.isRunning = false;
                matchData.currentSeconds = 0;
                matchData.timer = 0;
                matchData.minute = 0;
                matchData.second = 0;
                timerData = {
                    matchId: matchId,
                    isRunning: false,
                    currentSeconds: 0,
                    timer: 0,
                    minute: 0,
                    second: 0
                };
                
                // 서버 측 타이머도 리셋
                resetMatchTimer(matchId);
            }
            
            await match.update({
                match_data: matchData
            });
            
            // 해당 경기의 모든 클라이언트에게 타이머 업데이트 전송
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('timer_updated', timerData);
            
            // 리스트 오버레이에도 타이머 업데이트 전송
            const rooms = Array.from(io.sockets.adapter.rooms.keys()).filter(room => room.startsWith('list_overlay_'));
            rooms.forEach(room => {
                io.to(room).emit('timer_updated', timerData);
            });
            
            logger.info(`타이머 업데이트 전송 완료: matchId=${matchId}, action=${action}, currentSeconds=${timerData.currentSeconds}`);
        } catch (error) {
            logger.error('timer_control 이벤트 처리 중 오류 발생:', error);
        }
    });

    // 리스트 오버레이 경기 변경 이벤트 처리
    socket.on('push_to_list_overlay', async (data) => {
        try {
            const { listId, matchIndex, matchId, forceRefresh = false } = data;
            const roomName = `list_overlay_${listId}`;
            
            logger.info(`=== 푸시 요청 수신 ===`);
            logger.info(`listId: ${listId}, matchIndex: ${matchIndex}, matchId: ${matchId}, forceRefresh: ${forceRefresh}`);
            
            // 강제 새로고침 요청인 경우 캐시 무효화
            if (forceRefresh) {
                logger.info(`강제 새로고침 요청: ${listId}`);
                // 기존 푸시 정보 초기화
                pushedMatches.delete(listId);
            }
            
            // matchId로 경기 정보를 직접 가져오기
            let actualMatch;
            if (matchId) {
                logger.info(`matchId로 경기 조회: ${matchId}`);
                actualMatch = await Match.findByPk(matchId);
                if (!actualMatch) {
                    throw new Error('경기를 찾을 수 없습니다.');
                }
                logger.info(`경기 조회 성공:`, JSON.stringify(actualMatch.toJSON(), null, 2));
            } else {
                // 기존 방식: 리스트에서 경기 정보 가져오기
                const list = await MatchList.findByPk(listId);
                if (!list || !list.matches || matchIndex >= list.matches.length) {
                    throw new Error('리스트 또는 경기를 찾을 수 없습니다.');
                }
                
                const currentMatch = list.matches[matchIndex];
                actualMatch = await Match.findByPk(currentMatch.id);
                if (!actualMatch) {
                    throw new Error('경기를 찾을 수 없습니다.');
                }
            }
            
            // 실제 경기 데이터를 완전히 구성 (최신 타이머 정보 포함)
            const actualMatchData = actualMatch.match_data || {};
            
            // 타이머 정보를 명확하게 구성
            const currentSeconds = actualMatchData.currentSeconds || actualMatchData.timer || 0;
            const minute = actualMatchData.minute || Math.floor(currentSeconds / 60);
            const second = actualMatchData.second || (currentSeconds % 60);
            const isRunning = actualMatchData.isRunning || false;
            
            const matchData = {
                id: actualMatch.id,
                sport_type: actualMatch.sport_type || 'soccer',
                home_team: actualMatch.home_team || 'HOME',
                away_team: actualMatch.away_team || 'AWAY',
                home_score: actualMatch.home_score || actualMatchData.home_score || 0,
                away_score: actualMatch.away_score || actualMatchData.away_score || 0,
                home_team_color: actualMatch.home_team_color || '#1e40af',
                away_team_color: actualMatch.away_team_color || '#1e40af',
                match_data: {
                    state: actualMatchData.state || '전반',
                    timer: currentSeconds,
                    minute: minute,
                    second: second,
                    currentSeconds: currentSeconds,
                    isRunning: isRunning,
                    // 야구 특화 데이터
                    current_inning: actualMatchData.current_inning || 1,
                    inning_type: actualMatchData.inning_type || 'top',
                    first_base: actualMatchData.first_base || false,
                    second_base: actualMatchData.second_base || false,
                    third_base: actualMatchData.third_base || false,
                    balls: actualMatchData.balls || 0,
                    strikes: actualMatchData.strikes || 0,
                    outs: actualMatchData.outs || 0,
                    // 모든 추가 데이터 포함
                    ...actualMatchData
                }
            };
            
            // 해당 리스트 오버레이 방의 모든 클라이언트에게 경기 변경 알림
            const eventData = {
                listId: listId,
                matchIndex: matchIndex,
                match: matchData,
                timestamp: Date.now()
            };
            
            // 통합 오버레이와 기존 리스트 오버레이 모두에 전송
            io.to(roomName).emit('list_overlay_match_changed', eventData);
            
            logger.info(`=== 푸시 완료 ===`);
            logger.info(`listId: ${listId}, matchIndex: ${matchIndex}, matchId: ${matchId || 'N/A'}`);
            logger.info(`전송할 경기 데이터:`, JSON.stringify(matchData, null, 2));
            
            // 현재 푸시된 경기 정보 저장
            pushedMatches.set(listId, {
                matchId: actualMatch.id,
                matchIndex: matchIndex,
                timestamp: Date.now()
            });
            
            // 성공 응답
            socket.emit('push_to_list_overlay_response', { 
                success: true, 
                message: '경기가 성공적으로 푸시되었습니다.',
                matchId: actualMatch.id
            });
        } catch (error) {
            logger.error('push_to_list_overlay 이벤트 처리 중 오류 발생:', error);
            socket.emit('push_to_list_overlay_response', { success: false, error: error.message });
        }
    });

    // 통합 오버레이 방 조인 이벤트 처리
    socket.on('join_unified_overlay', (data) => {
        try {
            const { listId } = data;
            const roomName = `list_overlay_${listId}`;
            
            logger.info(`=== 통합 오버레이 방 조인 ===`);
            logger.info(`socketId: ${socket.id}, listId: ${listId}, roomName: ${roomName}`);
            
            // 기존 방에서 나가기 (중복 방지)
            socket.rooms.forEach(room => {
                if (room.startsWith('list_overlay_')) {
                    socket.leave(room);
                    logger.info(`기존 방에서 나감: ${room}`);
                }
            });
            
            // 새 방에 참가
            socket.join(roomName);
            
            // 소켓에 리스트 ID 저장 (연결 해제 시 사용)
            socket.listId = listId;
            
            logger.info(`통합 오버레이 방 조인 완료: ${roomName}`);
        } catch (error) {
            logger.error('join_unified_overlay 이벤트 처리 중 오류 발생:', error);
        }
    });



    // 중복된 타이머 상태 요청 핸들러 제거됨 (1467라인의 새로운 독립 타이머 시스템 사용)

    // match_update 이벤트 처리
    socket.on('match_update', async (data) => {
        try {
            const { matchId, data: updateData } = data;
            const roomName = `match_${matchId}`;
            
            // 데이터베이스 업데이트
            const match = await Match.findByPk(matchId);
            if (!match) {
                throw new Error('경기를 찾을 수 없습니다.');
            }

            // match_data 업데이트
            if (updateData) {
                match.match_data = {
                    ...match.match_data,
                    ...updateData
                };
                await match.save();
            }

            // JSON 파일 업데이트
            const matchesDir = path.join(__dirname, 'public', 'matches');
            const jsonPath = path.join(matchesDir, `${matchId}.json`);

            // matches 디렉토리가 없으면 생성
            if (!fsSync.existsSync(matchesDir)) {
                fsSync.mkdirSync(matchesDir, { recursive: true });
            }

            // 중복 제거된 데이터 구조 생성
            const jsonData = {
                id: match.id,
                sport_type: match.sport_type,
                status: match.status,
                home_score: match.match_data.home_score || 0,
                away_score: match.match_data.away_score || 0,
                match_data: match.match_data,
                created_at: match.created_at,
                updated_at: match.updated_at
            };

            await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));

            // 해당 매치룸의 모든 클라이언트에게 업데이트 전송
            io.to(roomName).emit('match_update', {
                matchId: matchId,
                home_score: jsonData.home_score,
                away_score: jsonData.away_score,
                match_data: jsonData.match_data
            });

            // 성공 응답 전송
            socket.emit('match_update_response', { success: true });
            
            logger.info(`match_update 이벤트를 방 ${roomName}의 모든 클라이언트에 전송함`);
        } catch (error) {
            logger.error('match_update 이벤트 처리 중 오류 발생:', error);
            socket.emit('match_update_response', { success: false, error: error.message });
        }
    });

    // 야구 팀로고 업데이트 이벤트 처리
    socket.on('baseballTeamLogoUpdated', (data) => {
        try {
            const { matchId, teamType, path, bgColor, teamColor } = data;
            const roomName = `match_${matchId}`;
            
            logger.info(`야구 팀로고 업데이트: matchId=${matchId}, teamType=${teamType}, path=${path}, bgColor=${bgColor}`);
            
            // 해당 매치룸의 모든 클라이언트에게 팀로고 업데이트 전송
            io.to(roomName).emit('baseballTeamLogoUpdated', {
                matchId: matchId,
                teamType: teamType,
                path: path,
                bgColor: bgColor,
                teamColor: teamColor
            });
            
            logger.info(`baseballTeamLogoUpdated 이벤트를 방 ${roomName}의 모든 클라이언트에 전송함`);
        } catch (error) {
            logger.error('baseballTeamLogoUpdated 이벤트 처리 중 오류 발생:', error);
        }
    });

    // 타이머 제어 이벤트 처리 (호환성 지원)
    socket.on('timer_control', async (data) => {
        try {
            const { matchId, action, minutes, seconds, currentTime } = data;
            logger.info(`타이머 제어: matchId=${matchId}, action=${action}, minutes=${minutes}, seconds=${seconds}, currentTime=${currentTime}`);
            
            // 경기 데이터 업데이트
            const match = await Match.findByPk(matchId);
            if (!match) {
                throw new Error('경기를 찾을 수 없습니다.');
            }
            
            const matchData = match.match_data || {};
            let timerData = {};
            
            if (action === 'set') {
                const targetTime = (minutes * 60) + seconds;
                const timerData = {
                    startTime: Date.now() - (targetTime * 1000),
                    pausedTime: targetTime,
                    isRunning: false,
                    matchId: matchId
                };
                
                matchTimerData.set(matchId, timerData);
                
                // DB 업데이트 대기열에 추가
                pendingDbUpdates.set(matchId, {
                    timer_startTime: timerData.startTime,
                    timer_pausedTime: timerData.pausedTime,
                    isRunning: false,
                    lastUpdateTime: Date.now()
                });
                
                // 새로운 독립 타이머 이벤트 전송
                io.to(`match_${matchId}`).emit('timer_set', timerData);
                
                // 기존 방식 호환성을 위한 이벤트도 전송
                io.to(`match_${matchId}`).emit('timer_updated', {
                    matchId: matchId,
                    currentSeconds: targetTime,
                    isRunning: false,
                    minute: Math.floor(targetTime / 60),
                    second: targetTime % 60,
                    lastUpdateTime: Date.now()
                });
                
                logger.info(`타이머 설정 완료: matchId=${matchId}, minutes=${minutes}, seconds=${seconds}`);
                
            } else if (action === 'start') {
                startMatchTimer(matchId);
                
                // 기존 방식 호환성을 위한 이벤트도 전송
                const timerData = matchTimerData.get(matchId);
                if (timerData) {
                    io.to(`match_${matchId}`).emit('timer_updated', {
                        matchId: matchId,
                        currentSeconds: timerData.pausedTime,
                        isRunning: true,
                        minute: Math.floor(timerData.pausedTime / 60),
                        second: timerData.pausedTime % 60,
                        lastUpdateTime: Date.now()
                    });
                }
                
            } else if (action === 'stop') {
                stopMatchTimer(matchId);
                
                // 기존 방식 호환성을 위한 이벤트도 전송
                const timerData = matchTimerData.get(matchId);
                if (timerData) {
                    const currentSeconds = timerData.pausedTime;
                    io.to(`match_${matchId}`).emit('timer_updated', {
                        matchId: matchId,
                        currentSeconds: currentSeconds,
                        isRunning: false,
                        minute: Math.floor(currentSeconds / 60),
                        second: currentSeconds % 60,
                        lastUpdateTime: Date.now()
                    });
                }
                
            } else if (action === 'reset') {
                resetMatchTimer(matchId);
                
                // 기존 방식 호환성을 위한 이벤트도 전송
                io.to(`match_${matchId}`).emit('timer_updated', {
                    matchId: matchId,
                    currentSeconds: 0,
                    isRunning: false,
                    minute: 0,
                    second: 0,
                    lastUpdateTime: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('timer_control 이벤트 처리 중 오류 발생:', error);
        }
    });

    // 애니메이션 이벤트 처리
    socket.on('animation', (data) => {
        const { matchId, section, all } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 animation 이벤트 수신: ${JSON.stringify(data)}`);
        
        // 해당 방의 모든 클라이언트에게 애니메이션 이벤트 전송
        io.to(roomName).emit('animation', {
            section: section,
            all: all
        });
        
        // 응답 전송
        socket.emit('animation_response', {
            success: true,
            message: `애니메이션 이벤트를 방 ${roomName}에 전송함`
        });
        
        logger.info(`animation 이벤트를 방 ${roomName}에 전송함`);
    });
    
    // 팀 컬러 업데이트 이벤트 처리
    socket.on('updateTeamColor', async (data) => {
        const { matchId, teamType, teamColor, headerText, sportType } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 팀 컬러 업데이트 요청: ${JSON.stringify(data)}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('teamColorUpdated', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 팀 컬러 업데이트
            const updateField = teamType === 'home' ? 'home_team_color' : 'away_team_color';
            
            // match_data JSON에도 팀 컬러 정보 추가
            const matchData = match.match_data || {};
            const colorField = teamType === 'home' ? 'home_team_color' : 'away_team_color';
            matchData[colorField] = teamColor;
            
            // 축구인 경우에만 팀 헤더 텍스트도 업데이트
            if (sportType === 'soccer' && headerText) {
                const headerField = teamType === 'home' ? 'home_team_header' : 'away_team_header';
                await match.update({ 
                    [updateField]: teamColor,
                    [headerField]: headerText,
                    match_data: matchData
                });
                
                // 팀 헤더 텍스트 업데이트 알림
                io.to(roomName).emit('teamHeaderUpdate', {
                    matchId: matchId,
                    teamType: teamType,
                    headerText: headerText
                });

                // 즉시 반영을 위한 전체 헤더 텍스트 정보 전송
                io.to(roomName).emit('teamHeaderChanged', {
                    matchId: matchId,
                    homeHeader: teamType === 'home' ? headerText : match.home_team_header,
                    awayHeader: teamType === 'away' ? headerText : match.away_team_header
                });
            } else {
                // 야구인 경우 팀 컬러만 업데이트
                await match.update({ 
                    [updateField]: teamColor,
                    match_data: matchData
                });
                
                // 야구인 경우 team_logo_map.json에도 팀 컬러 저장
                if (sportType === 'baseball') {
                    try {
                        const teamName = teamType === 'home' ? match.home_team : match.away_team;
                        const logoMapPath = path.join(__dirname, 'public/TEAMLOGO/BASEBALL/team_logo_map.json');
                        
                        // 기존 파일 읽기
                        let teamLogoMap = {};
                        if (fsSync.existsSync(logoMapPath)) {
                            const fileContent = await fs.readFile(logoMapPath, 'utf8');
                            const parsed = JSON.parse(fileContent);
                            teamLogoMap = parsed.teamLogoMap || {};
                        }
                        
                        // 팀 컬러 정보 업데이트
                        if (!teamLogoMap[teamName]) {
                            teamLogoMap[teamName] = {};
                        }
                        teamLogoMap[teamName].teamColor = teamColor;
                        
                        // 파일 저장
                        const updatedData = {
                            sport: 'BASEBALL',
                            teamLogoMap: teamLogoMap
                        };
                        
                        await fs.writeFile(logoMapPath, JSON.stringify(updatedData, null, 2), 'utf8');
                        logger.info(`야구 팀 컬러가 team_logo_map.json에 저장됨: ${teamName} -> ${teamColor}`);
                    } catch (logoError) {
                        logger.error('team_logo_map.json 업데이트 중 오류:', logoError);
                        // 로고 맵 업데이트 실패해도 팀 컬러 업데이트는 계속 진행
                    }
                }
            }
            
            // 모든 클라이언트에게 팀 컬러 업데이트 알림
            io.to(roomName).emit('teamColorUpdate', {
                matchId: matchId,
                teamType: teamType,
                teamColor: teamColor
            });

            // 즉시 반영을 위한 전체 색상 정보 전송
            io.to(roomName).emit('teamColorChanged', {
                matchId: matchId,
                homeColor: teamType === 'home' ? teamColor : match.home_team_color,
                awayColor: teamType === 'away' ? teamColor : match.away_team_color
            });
            
            // 성공 응답 전송
            socket.emit('teamColorUpdated', { success: true });
            
            logger.info(`팀 컬러 업데이트 성공: ${teamType}팀, 컬러: ${teamColor}`);
        } catch (error) {
            logger.error('팀 컬러 업데이트 중 오류 발생:', error);
            socket.emit('teamColorUpdated', { success: false, error: error.message });
        }
    });
    
    // 팀 헤더 텍스트 업데이트 이벤트 처리
    socket.on('updateTeamHeader', async (data) => {
        const { matchId, teamType, headerText } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 팀 헤더 텍스트 업데이트 요청: ${JSON.stringify(data)}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('teamHeaderUpdated', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 팀 헤더 텍스트 업데이트
            const updateField = teamType === 'home' ? 'home_team_header' : 'away_team_header';
            await match.update({ [updateField]: headerText });
            
            // 업데이트된 매치 정보 다시 가져오기
            const updatedMatch = await Match.findByPk(matchId);
            
            // 모든 클라이언트에게 팀 헤더 텍스트 업데이트 알림
            io.to(roomName).emit('teamHeaderUpdate', {
                matchId: matchId,
                teamType: teamType,
                headerText: headerText
            });

            // 즉시 반영을 위한 전체 헤더 텍스트 정보 전송
            io.to(roomName).emit('teamHeaderChanged', {
                matchId: matchId,
                homeHeader: updatedMatch.home_team_header || 'HOME',
                awayHeader: updatedMatch.away_team_header || 'AWAY'
            });
            
            // 성공 응답 전송
            socket.emit('teamHeaderUpdated', { success: true });
            
            logger.info(`팀 헤더 텍스트 업데이트 성공: ${teamType}팀, 텍스트: ${headerText}`);
        } catch (error) {
            logger.error('팀 헤더 텍스트 업데이트 중 오류 발생:', error);
            socket.emit('teamHeaderUpdated', { success: false, error: error.message });
        }
    });

    // 특수 애니메이션 이벤트 처리
    socket.on('special_animation', (data) => {
        const { matchId, type } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 special_animation 이벤트 수신: ${JSON.stringify(data)}`);
        
        // 해당 방의 모든 클라이언트에게 특수 애니메이션 이벤트 전송
        io.to(roomName).emit('special_animation', {
            type: type
        });
        
        // 응답 전송
        socket.emit('animation_response', {
            success: true,
            message: `특수 애니메이션 이벤트를 방 ${roomName}에 전송함`
        });
        
        logger.info(`special_animation 이벤트를 방 ${roomName}에 전송함`);
    });

    // 팀 이름 업데이트 이벤트 처리
    socket.on('updateTeamName', async (data) => {
        const { matchId, team, teamName } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 팀 이름 업데이트 요청: ${JSON.stringify(data)}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('teamNameUpdated', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 팀 이름 업데이트
            const updateField = team === 'home' ? 'home_team' : 'away_team';
            await match.update({ [updateField]: teamName });
            
            // 모든 클라이언트에게 팀 이름 업데이트 알림
            io.to(roomName).emit('teamNameUpdated', {
                matchId: matchId,
                team: team,
                teamName: teamName
            });
            
            // 성공 응답 전송
            socket.emit('teamNameUpdated', { success: true });
            
            logger.info(`팀 이름 업데이트 성공: ${team}팀, 이름: ${teamName}`);
        } catch (error) {
            logger.error('팀 이름 업데이트 중 오류 발생:', error);
            socket.emit('teamNameUpdated', { success: false, error: error.message });
        }
    });

    // 야구 이닝 스코어 업데이트 이벤트 처리
    socket.on('baseball_inning_score_update', async (data) => {
        const { matchId, team, inning, inningType, score, change } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`야구 이닝 스코어 업데이트: matchId=${matchId}, team=${team}, inning=${inning}, score=${score}, change=${change}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('baseball_inning_score_response', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 기존 match_data 가져오기
            const currentMatchData = match.match_data || {};
            const currentInnings = currentMatchData.innings || {};
            
            // 이닝 스코어 키 생성
            const inningKey = `${team}_${inning}`;
            
            // 이닝 스코어 업데이트
            let updatedInnings;
            
            if (change === 0) {
                // 초기화인 경우
                updatedInnings = {
                    ...currentInnings,
                    [inningKey]: score
                };
            } else {
                // 점수 변경인 경우
                const currentInningScore = parseInt(currentInnings[inningKey]) || 0;
                const newInningScore = Math.max(0, currentInningScore + change);
                
                updatedInnings = {
                    ...currentInnings,
                    [inningKey]: newInningScore
                };
                
                logger.info(`이닝 스코어 변경: ${inningKey} ${currentInningScore} + ${change} = ${newInningScore}`);
            }
            
            // match_data 업데이트
            const updatedMatchData = {
                ...currentMatchData,
                innings: updatedInnings
            };
            
            // 총 점수 계산
            const homeTotal = Object.keys(updatedInnings)
                .filter(key => key.startsWith('home_'))
                .reduce((sum, key) => sum + (parseInt(updatedInnings[key]) || 0), 0);
            const awayTotal = Object.keys(updatedInnings)
                .filter(key => key.startsWith('away_'))
                .reduce((sum, key) => sum + (parseInt(updatedInnings[key]) || 0), 0);
            
            // 데이터베이스 업데이트 (총 점수도 함께 업데이트)
            await match.update({
                home_score: homeTotal,
                away_score: awayTotal,
                match_data: updatedMatchData
            });
            
            // 모든 클라이언트에게 이닝 스코어 업데이트 전송
            io.to(roomName).emit('baseball_inning_score_updated', {
                matchId: matchId,
                team: team,
                inning: inning,
                inningType: inningType,
                score: updatedInnings[inningKey],
                change: change,
                innings: updatedInnings,
                home_score: homeTotal,
                away_score: awayTotal
            });
            
            logger.info(`야구 이닝 스코어 업데이트 완료: ${inningKey} = ${updatedInnings[inningKey]}`);
            
        } catch (error) {
            logger.error('야구 이닝 스코어 업데이트 오류:', error);
            socket.emit('baseball_inning_score_response', { success: false, error: error.message });
        }
    });

    // 야구 오버레이 표시/숨김 업데이트 이벤트 처리
    socket.on('baseball_overlay_visibility_update', async (data) => {
        const { matchId, overlayType, isVisible } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`야구 오버레이 표시 상태 업데이트: matchId=${matchId}, overlayType=${overlayType}, isVisible=${isVisible}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('baseball_overlay_visibility_response', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 기존 match_data 가져오기
            const currentMatchData = match.match_data || {};
            const currentOverlayVisibility = currentMatchData.overlay_visibility || {};
            
            // 오버레이 표시 상태 업데이트
            const updatedOverlayVisibility = {
                ...currentOverlayVisibility,
                [overlayType]: isVisible
            };
            
            // match_data 업데이트
            const updatedMatchData = {
                ...currentMatchData,
                overlay_visibility: updatedOverlayVisibility
            };
            
            // 데이터베이스 업데이트
            await match.update({
                match_data: updatedMatchData
            });
            
            // 모든 클라이언트에게 오버레이 표시 상태 업데이트 전송
            io.to(roomName).emit('baseball_overlay_visibility_updated', {
                matchId: matchId,
                overlayType: overlayType,
                isVisible: isVisible,
                overlay_visibility: updatedOverlayVisibility
            });
            
            logger.info(`야구 오버레이 표시 상태 업데이트 완료: ${overlayType} = ${isVisible}`);
            
        } catch (error) {
            logger.error('야구 오버레이 표시 상태 업데이트 오류:', error);
            socket.emit('baseball_overlay_visibility_response', { success: false, error: error.message });
        }
    });

    // 점수 동기화 이벤트 처리
    socket.on('sync_match_scores', async (data) => {
        const { matchId, home_score, away_score } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`점수 동기화 요청: matchId=${matchId}, home_score=${home_score}, away_score=${away_score}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('sync_match_scores_response', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 점수 업데이트
            await match.update({
                home_score: home_score,
                away_score: away_score
            });
            
            // 모든 클라이언트에게 점수 동기화 완료 알림
            io.to(roomName).emit('match_scores_synced', {
                matchId: matchId,
                home_score: home_score,
                away_score: away_score
            });
            
            logger.info(`점수 동기화 완료: 홈팀 ${home_score}, 원정팀 ${away_score}`);
            
        } catch (error) {
            logger.error('점수 동기화 오류:', error);
            socket.emit('sync_match_scores_response', { success: false, error: error.message });
        }
    });

    // 야구 경기 데이터 업데이트 이벤트 처리
    socket.on('baseball_update', async (data) => {
        const { matchId, data: matchData } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 baseball_update 이벤트 수신: ${JSON.stringify(matchData)}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('baseball_update_response', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 기존 데이터와 새로운 데이터 병합
            const updateData = {
                home_score: matchData.home_score,
                away_score: matchData.away_score,
                match_data: {
                    ...match.match_data,
                    current_inning: matchData.match_data.current_inning,
                    inning_type: matchData.match_data.inning_type,
                    first_base: matchData.match_data.first_base,
                    second_base: matchData.match_data.second_base,
                    third_base: matchData.match_data.third_base,
                    balls: matchData.match_data.balls,
                    strikes: matchData.match_data.strikes,
                    outs: matchData.match_data.outs,
                    batter_name: matchData.match_data.batter_name,
                    batter_number: matchData.match_data.batter_number,
                    batter_position: matchData.match_data.batter_position,
                    batter_avg: matchData.match_data.batter_avg,
                    pitcher_name: matchData.match_data.pitcher_name,
                    pitcher_number: matchData.match_data.pitcher_number,
                    pitcher_position: matchData.match_data.pitcher_position,
                    pitcher_era: matchData.match_data.pitcher_era,
                    home_hits: matchData.match_data.home_hits,
                    away_hits: matchData.match_data.away_hits,
                    home_errors: matchData.match_data.home_errors,
                    away_errors: matchData.match_data.away_errors,
                    innings: matchData.match_data.innings
                }
            };

            // 데이터 업데이트
            await match.update(updateData);
            
            // 모든 클라이언트에게 업데이트 전송
            io.to(roomName).emit('match_update', {
                matchId: matchId,
                home_score: updateData.home_score,
                away_score: updateData.away_score,
                match_data: updateData.match_data
            });
            
            // 성공 응답 전송
            socket.emit('baseball_update_response', { success: true });
            
            logger.info(`야구 경기 데이터 업데이트 성공: ${matchId}`);
        } catch (error) {
            logger.error('야구 경기 데이터 업데이트 중 오류 발생:', error);
            socket.emit('baseball_update_response', { success: false, error: error.message });
        }
    });

    // 팀 로고 업데이트 소켓 이벤트
    socket.on('teamLogoUpdated', async (data) => {
        try {
            const { matchId, teamType, path: logoPath, bgColor: logoBgColor, teamName } = data;
            const roomName = `match_${matchId}`;
            const match = await Match.findByPk(matchId);
            
            if (!match) {
                socket.emit('error', { message: '경기를 찾을 수 없습니다.' });
                return;
            }

            // 1. 매치 데이터 업데이트
            const matchData = { ...match.match_data } || {};
            matchData[`${teamType}_team_logo`] = logoPath;
            matchData[`${teamType}_team_bg_color`] = logoBgColor;
            
            await match.update({ match_data: matchData });

            // 2. 팀별 로고 매핑 정보 업데이트
            const logoFileName = logoPath ? decodeURIComponent(logoPath.split('/').pop()) : null;
            
            const logoDir = path.join(__dirname, 'public/TEAMLOGO/SOCCER');
            const teamLogoMapPath = path.join(logoDir, 'team_logo_map.json');
            
            // 기존 매핑 정보 읽기
            let teamLogoMap = {};
            if (fsSync.existsSync(teamLogoMapPath)) {
                teamLogoMap = JSON.parse(fsSync.readFileSync(teamLogoMapPath, 'utf8'));
            }
            
            // 새 매핑 정보 추가
            teamLogoMap[teamName] = {
                path: logoPath,
                bgColor: logoBgColor,
                matchId: matchId,
                teamType: teamType,
                lastUpdated: new Date().toISOString()
            };
            
            // 파일로 저장
            await fs.writeFile(teamLogoMapPath, JSON.stringify(teamLogoMap, null, 2), 'utf8');
            
            logger.info(`팀 로고 매핑 정보 업데이트: ${teamName} => ${logoFileName}`);

            // 3. 소켓 이벤트 발생
            io.to(roomName).emit('teamLogoUpdated', {
                matchId,
                teamType,
                path: logoPath,
                bgColor: logoBgColor,
                teamName,
                success: true
            });
        } catch (error) {
            logger.error('팀 로고 업데이트 오류:', error);
            socket.emit('error', { message: '서버 오류가 발생했습니다.' });
        }
    });

    // 테스트 이벤트 처리
    socket.on('test_event', (data) => {
        try {
            const { matchId, message, timestamp } = data;
            const roomName = `match_${matchId}`;
            
            console.log('=== 서버: 테스트 이벤트 수신 ===');
            console.log('matchId:', matchId);
            console.log('message:', message);
            console.log('timestamp:', timestamp);
            console.log('roomName:', roomName);
            console.log('socket.id:', socket.id);
            
            // 해당 매치룸의 모든 클라이언트에게 전달
            io.to(roomName).emit('test_event', {
                matchId: matchId,
                message: message,
                timestamp: timestamp
            });
            
            console.log('=== 서버: 테스트 이벤트 전달 완료 ===');
        } catch (error) {
            console.error('테스트 이벤트 처리 오류:', error);
        }
    });

    // 팀로고 가시성 변경 이벤트 처리
    socket.on('teamLogoVisibilityChanged', (data) => {
        try {
            const { matchId, useLogos } = data;
            const roomName = `match_${matchId}`;
            
            console.log('=== 서버: 팀로고 가시성 변경 이벤트 수신 ===');
            console.log('matchId:', matchId);
            console.log('useLogos:', useLogos);
            console.log('roomName:', roomName);
            console.log('socket.id:', socket.id);
            
            // 해당 매치룸의 모든 클라이언트에게 전달
            io.to(roomName).emit('teamLogoVisibilityChanged', {
                matchId: matchId,
                useLogos: useLogos
            });
            
            console.log('=== 서버: 팀로고 가시성 변경 이벤트 전달 완료 ===');
            logger.info(`팀로고 가시성 변경 이벤트 전달: ${matchId}, useLogos: ${useLogos}`);
        } catch (error) {
            console.error('팀로고 가시성 변경 이벤트 처리 오류:', error);
            logger.error('팀로고 가시성 변경 이벤트 처리 오류:', error);
        }
    });

    // 스코어 보드 추가 박스 토글 이벤트 처리
    socket.on('toggleExtraBox', (data) => {
        try {
            const { matchId } = data;
            const roomName = `match_${matchId}`;
            
            console.log('=== 서버: 추가 박스 토글 이벤트 수신 ===');
            console.log('matchId:', matchId);
            console.log('roomName:', roomName);
            console.log('socket.id:', socket.id);
            
            // 해당 매치룸의 모든 클라이언트에게 전달
            io.to(roomName).emit('toggleExtraBox', {
                matchId: matchId
            });
            
            console.log('=== 서버: 추가 박스 토글 이벤트 전달 완료 ===');
            logger.info(`추가 박스 토글 이벤트 전달: ${matchId}`);
        } catch (error) {
            console.error('추가 박스 토글 이벤트 처리 오류:', error);
            logger.error('추가 박스 토글 이벤트 처리 오류:', error);
        }
    });

    // 스코어 보드 추가 박스 텍스트 업데이트 이벤트 처리
    socket.on('updateExtraBoxText', (data) => {
        try {
            const { matchId, text } = data;
            const roomName = `match_${matchId}`;
            
            console.log('=== 서버: 추가 박스 텍스트 업데이트 이벤트 수신 ===');
            console.log('matchId:', matchId);
            console.log('text:', text);
            console.log('roomName:', roomName);
            console.log('socket.id:', socket.id);
            
            // 해당 매치룸의 모든 클라이언트에게 전달
            io.to(roomName).emit('updateExtraBoxText', {
                matchId: matchId,
                text: text
            });
            
            console.log('=== 서버: 추가 박스 텍스트 업데이트 이벤트 전달 완료 ===');
            logger.info(`추가 박스 텍스트 업데이트 이벤트 전달: ${matchId}, text: ${text}`);
        } catch (error) {
            console.error('추가 박스 텍스트 업데이트 이벤트 처리 오류:', error);
            logger.error('추가 박스 텍스트 업데이트 이벤트 처리 오류:', error);
        }
    });

    // 팀 로고 삭제 소켓 이벤트
    socket.on('removeTeamLogo', async (data) => {
        try {
            const { matchId, teamType, teamName } = data;
            const roomName = `match_${matchId}`;
            const match = await Match.findByPk(matchId);
            
            if (!match) {
                socket.emit('teamLogoRemoved', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }

            const matchData = { ...match.match_data } || {};
            // 로고 경로 정보 백업
            const logoPath = matchData[`${teamType}_team_logo`];
            // 로고 정보와 배경색 정보 삭제
            matchData[`${teamType}_team_logo`] = null;
            matchData[`${teamType}_team_bg_color`] = null;
            
            await match.update({ match_data: matchData });
            
            // 팀별 로고 매핑 정보에서 삭제
            try {
                // 팀 로고 매핑 파일 경로
                const logoDir = path.join(__dirname, 'public/TEAMLOGO/SOCCER');
                const teamLogoMapPath = path.join(logoDir, 'team_logo_map.json');
                
                // 기존 매핑 정보 읽기
                if (fsSync.existsSync(teamLogoMapPath)) {
                    let teamLogoMap = JSON.parse(fsSync.readFileSync(teamLogoMapPath, 'utf8'));
                    
                    // 팀 로고 매핑 삭제
                    delete teamLogoMap[teamName];
                    
                    // 파일로 저장
                    fsSync.writeFileSync(teamLogoMapPath, JSON.stringify(teamLogoMap, null, 2), 'utf8');
                    
                    logger.info(`팀 로고 매핑 정보 삭제: ${teamName}`);
                }
            } catch (mapError) {
                logger.error('팀 로고 매핑 정보 삭제 오류:', mapError);
            }
            
            // 해당 매치룸의 모든 클라이언트에게 업데이트 알림
            io.to(roomName).emit('teamLogoRemoved', {
                matchId,
                teamType,
                teamName,
                success: true
            });
        } catch (error) {
            console.error('팀 로고 삭제 오류:', error);
            socket.emit('teamLogoRemoved', { success: false, error: '서버 오류가 발생했습니다.' });
        }
    });

    // 매치룸 참여 이벤트 처리
    socket.on('join', (matchId) => {
        const roomName = `match_${matchId}`;
        socket.join(roomName);
        logger.info(`클라이언트 ${socket.id}가 매치룸 ${roomName}에 참여했습니다.`);
    });

    // 야구 전용 팀 컬러/로고/로고배경색 실시간 반영 이벤트
    socket.on('baseballTeamLogoUpdated', (data) => {
        const { matchId } = data;
        const roomName = `match_${matchId}`;
        // 같은 matchId의 모든 클라이언트에 broadcast
        io.to(roomName).emit('baseballTeamLogoUpdated', data);
        logger.info(`baseballTeamLogoUpdated 이벤트를 방 ${roomName}에 broadcast함: ${JSON.stringify(data)}`);
    });

    // 연결 해제
    socket.on('disconnect', () => {
        logger.info(`클라이언트 ${socket.id} 연결 해제됨`);
        
        // 리스트 오버레이 방에서 나가기
        if (socket.listId) {
            const roomName = `list_overlay_${socket.listId}`;
            socket.leave(roomName);
            logger.info(`리스트 오버레이 방에서 나감: ${roomName}`);
        }
        
        // 모든 리스트 오버레이 방에서 나가기
        socket.rooms.forEach(room => {
            if (room.startsWith('list_overlay_')) {
                socket.leave(room);
                logger.info(`리스트 오버레이 방에서 나감: ${room}`);
            }
        });
    });
});

// 경기 데이터 업데이트 API
app.post('/api/match/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const matchData = req.body;

        const match = await Match.findByPk(id);
        if (!match) {
            return res.status(404).json({ success: false, error: '경기를 찾을 수 없습니다.' });
        }

        // 점수 업데이트
        if (matchData.home_score !== undefined) {
            match.home_score = matchData.home_score;
        }
        if (matchData.away_score !== undefined) {
            match.away_score = matchData.away_score;
        }

        // match_data 업데이트
        if (matchData.match_data) {
            match.match_data = {
                ...match.match_data,
                ...matchData.match_data
            };
        }

        await match.save();

        // Socket.IO를 통해 업데이트 전파
        io.to(`match_${id}`).emit('match_update', {
            matchId: id,
            home_score: match.home_score,
            away_score: match.away_score,
            match_data: match.match_data
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('경기 데이터 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 로고 삭제 API
app.post('/api/remove-logo', async (req, res) => {
    try {
        const { matchId, teamType, sportType } = req.body;

        // 로고 매핑 파일 경로
        const logoDir = path.join(__dirname, 'public', 'TEAMLOGO', sportType);
        const logoMappingPath = path.join(logoDir, 'team_logo_map.json');

        if (!fsSync.existsSync(logoMappingPath)) {
            return res.json({ success: true }); // 매핑 파일이 없으면 이미 삭제된 것으로 간주
        }

        // 로고 매핑 파일 읽기
        const data = await fs.readFile(logoMappingPath, 'utf8');
        const logoMap = JSON.parse(data);

        // 매치의 로고 정보가 있는지 확인
        if (logoMap[matchId] && logoMap[matchId][teamType]) {
            const logoInfo = logoMap[matchId][teamType];
            
            // 로고 파일 삭제
            if (logoInfo.logoPath) {
                const logoPath = path.join(__dirname, 'public', logoInfo.logoPath);
                if (fsSync.existsSync(logoPath)) {
                    fsSync.unlinkSync(logoPath);
                }
            }

            // 매핑 정보에서 삭제
            delete logoMap[matchId][teamType];

            // 매핑 파일 저장
            await fs.writeFile(logoMappingPath, JSON.stringify(logoMap, null, 2));

            // 데이터베이스 업데이트
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = match.match_data || {};
                delete matchData[`${teamType}_team_logo`];
                delete matchData[`${teamType}_team_bg_color`];
                await match.update({ match_data: matchData });
            }
        }

        res.json({ success: true });

    } catch (error) {
        logger.error('로고 삭제 중 오류 발생:', error);
        res.status(500).json({ success: false, error: '로고 삭제 중 오류가 발생했습니다.' });
    }
});

// 서버 시작 시 기본 종목 추가
const defaultSports = [
  { name: '축구', code: 'SOCCER', template: 'soccer', is_default: true },
  { name: '야구', code: 'BASEBALL', template: 'baseball', is_default: true }
];

// 기본 종목 초기화 함수
async function initializeDefaultSports() {
  try {
    for (const sport of defaultSports) {
      const [existingSport, created] = await Sport.findOrCreate({
        where: { code: sport.code },
        defaults: {
          ...sport,
          is_active: true
        }
      });

      if (!created) {
        // 기존 종목이 있으면 is_default와 is_active 값을 업데이트
        await existingSport.update({
          is_default: true,
          is_active: true,
          name: sport.name,
          template: sport.template
        });
        logger.info(`기본 종목 업데이트됨: ${sport.name}`);
      } else {
        logger.info(`기본 종목 추가됨: ${sport.name}`);
      }
    }
  } catch (error) {
    logger.error('기본 종목 초기화 중 오류 발생:', error);
  }
}

// 기본 설정 초기화 함수
async function initializeDefaultSettings() {
  try {
    // 기본 팀 컬러 설정이 없으면 생성
    const [homeColorSetting, homeCreated] = await Settings.findOrCreate({
      where: { key: 'default_home_color' },
      defaults: {
        value: '#1e40af',
        description: '홈팀 기본 컬러'
      }
    });

    const [awayColorSetting, awayCreated] = await Settings.findOrCreate({
      where: { key: 'default_away_color' },
      defaults: {
        value: '#1e40af',
        description: '원정팀 기본 컬러'
      }
    });

    if (homeCreated) {
      logger.info('홈팀 기본 컬러 설정 초기화됨');
    }
    if (awayCreated) {
      logger.info('원정팀 기본 컬러 설정 초기화됨');
    }
  } catch (error) {
    logger.error('기본 설정 초기화 중 오류 발생:', error);
  }
}

// 서버 시작
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  logger.info(`환경: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Railway 환경: ${process.env.RAILWAY_ENVIRONMENT ? 'Yes' : 'No'}`);
  logger.info(`데이터베이스: ${process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
  
  // 기본 종목 초기화
  await initializeDefaultSports();
  
  // 기본 설정 초기화
  await initializeDefaultSettings();
  
  await restoreMatchTimers();
  // 데이터베이스 동기화는 이미 수동으로 완료되었으므로 건너뜀
  // await sequelize.sync({ alter: true });
  
  // 자동 로그 관리 스케줄러 시작
  startLogManagementScheduler();
});

// 템플릿 미리보기 API
app.post('/api/preview-template', async (req, res) => {
  try {
    const { content } = req.body;
    
    // 임시 EJS 템플릿 생성
    const tempTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
    
    // EJS 렌더링
    const rendered = await ejs.render(tempTemplate, {
      match: {
        id: 'preview',
        sport_type: 'soccer',
        home_team: '홈팀',
        away_team: '원정팀',
        home_score: 0,
        away_score: 0,
        match_data: {
          state: '경기 전',
          home_shots: 0,
          away_shots: 0,
          home_shots_on_target: 0,
          away_shots_on_target: 0,
          home_corners: 0,
          away_corners: 0,
          home_fouls: 0,
          away_fouls: 0
        }
      }
    });

    // 임시 파일로 저장
    const tempFileName = `preview_${Date.now()}.html`;
    const tempFilePath = path.join(__dirname, 'public', 'temp', tempFileName);
    
    // temp 디렉토리가 없으면 생성
    const tempDir = path.join(__dirname, 'public', 'temp');
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }
    
    // 파일 저장
    await fs.writeFile(tempFilePath, rendered, 'utf8');
    
    // URL 반환
    res.json({
      url: `/temp/${tempFileName}`,
      content: rendered
    });
  } catch (error) {
    logger.error('템플릿 미리보기 생성 실패:', error);
    res.status(500).json({ error: '템플릿 미리보기 생성에 실패했습니다.' });
  }
});

// 템플릿 오버레이 라우트
app.get('/templates/:id/overlay', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id);
    if (!template) {
      return res.status(404).send('템플릿을 찾을 수 없습니다.');
    }
    
    // EJS 파일 내용 읽기
    const fs = require('fs').promises;
    const path = require('path');
    let ejsContent = '';
    
    try {
      if (template.file_name) {
        const ejsPath = path.join(__dirname, 'views', template.file_name);
        ejsContent = await fs.readFile(ejsPath, 'utf8');
      } else {
        // 파일명이 없는 경우 기본 템플릿 사용
        const defaultPath = path.join(__dirname, 'views', 
          template.template_type === 'overlay' ? 'soccer-template.ejs' : 'soccer-control.ejs');
        ejsContent = await fs.readFile(defaultPath, 'utf8');
      }
    } catch (error) {
      logger.error('EJS 파일 읽기 실패:', error);
      ejsContent = template.content || '';
    }
    
    // EJS 렌더링
    const rendered = await ejs.render(ejsContent, {
      match: {
        id: 'preview',
        sport_type: template.sport_type,
        home_team: '홈팀',
        away_team: '원정팀',
        home_score: 0,
        away_score: 0,
        match_data: {
          state: '경기 전',
          home_shots: 0,
          away_shots: 0,
          home_shots_on_target: 0,
          away_shots_on_target: 0,
          home_corners: 0,
          away_corners: 0,
          home_fouls: 0,
          away_fouls: 0
        }
      }
    });
    
    res.send(rendered);
  } catch (error) {
    logger.error('템플릿 오버레이 렌더링 실패:', error);
    res.status(500).send('템플릿 오버레이 렌더링에 실패했습니다.');
  }
});

// test-template.ejs 파일 삭제 테스트
app.delete('/api/test-template', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'views', 'test-template.ejs');
    logger.info('=== test-template.ejs 파일 삭제 시도 ===');
    logger.info(`삭제할 파일 경로: ${filePath}`);

    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
      logger.info('test-template.ejs 파일 삭제 성공');
      res.json({ message: '파일이 성공적으로 삭제되었습니다.' });
    } else {
      logger.warn('test-template.ejs 파일이 존재하지 않습니다.');
      res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }
  } catch (error) {
    logger.error('파일 삭제 중 오류 발생:', error);
    res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
  }
});

// 템플릿 관리 페이지 렌더링
app.get('/templates', requireAdmin, (req, res) => {
  res.render('templates');
});

// 종목 관리 페이지 렌더링
app.get('/sports', requireAdmin, async (req, res) => {
  try {
    const sports = await Sport.findAll({
      order: [['id', 'ASC']]
    });
    
    // 사용자 정보를 별도로 가져와서 매핑
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name']
    });
    
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });
    
    // sports에 creator 정보 추가
    const sportsWithCreators = sports.map(sport => {
      const sportData = sport.toJSON();
      sportData.creator = userMap[sportData.created_by] || null;
      return sportData;
    });
    
    res.render('sports', { sports: sportsWithCreators, title: '종목 관리' });
  } catch (error) {
    logger.error('종목 목록 조회 중 오류:', error);
    res.status(500).send('종목 목록을 불러오는데 실패했습니다.');
  }
});

// 템플릿 생성 API
app.post('/api/templates', async (req, res) => {
  try {
    const { name, baseTemplate } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '템플릿 이름은 필수입니다.' });
    }

    // 이름 중복 확인
    const existingTemplate = await Template.findOne({ where: { name } });
    if (existingTemplate) {
      return res.status(400).json({ error: '이미 존재하는 템플릿 이름입니다.' });
    }

    // 기본 템플릿 파일들을 복사하여 새 템플릿 생성
    const viewsDir = path.join(__dirname, 'views');
    const templateDir = path.join(__dirname, 'template');
    
    // 기본 템플릿이 지정된 경우 해당 템플릿 사용, 아니면 soccer 기본값 사용
    const baseTemplateName = baseTemplate || 'soccer';
    
    // 기본 템플릿 파일 경로 확인 (template 폴더 또는 views 폴더)
    let baseTemplateFile = path.join(templateDir, `${baseTemplateName}-template.html`);
    let baseControlFile = path.join(viewsDir, `${baseTemplateName}-control.ejs`);
    let baseControlMobileFile = path.join(viewsDir, `${baseTemplateName}-control-mobile.ejs`);
    
    // template 폴더에 없으면 views 폴더에서 찾기
    if (!fsSync.existsSync(baseTemplateFile)) {
      baseTemplateFile = path.join(viewsDir, `${baseTemplateName}-template.ejs`);
    }
    
    // 등록된 템플릿인 경우 (soccer, baseball 등) views 폴더에서 직접 찾기
    if (baseTemplateName === 'soccer' || baseTemplateName === 'baseball') {
      baseTemplateFile = path.join(viewsDir, `${baseTemplateName}-template.ejs`);
      baseControlFile = path.join(viewsDir, `${baseTemplateName}-control.ejs`);
      baseControlMobileFile = path.join(viewsDir, `${baseTemplateName}-control-mobile.ejs`);
    }
    
    const newTemplateFile = path.join(viewsDir, `${name}-template.ejs`);
    const newControlFile = path.join(viewsDir, `${name}-control.ejs`);
    const newControlMobileFile = path.join(viewsDir, `${name}-control-mobile.ejs`);

    // 기본 파일들이 존재하는지 확인
    if (!fsSync.existsSync(baseTemplateFile)) {
      return res.status(500).json({ error: `기본 템플릿 파일을 찾을 수 없습니다: ${baseTemplateName}` });
    }
    
    if (!fsSync.existsSync(baseControlFile)) {
      return res.status(500).json({ error: `기본 컨트롤 파일을 찾을 수 없습니다: ${baseTemplateName}-control.ejs` });
    }
    
    if (!fsSync.existsSync(baseControlMobileFile)) {
      return res.status(500).json({ error: `기본 모바일 컨트롤 파일을 찾을 수 없습니다: ${baseTemplateName}-control-mobile.ejs` });
    }

    // 기본 템플릿 내용을 읽어서 복사
    let baseTemplateContent = fsSync.readFileSync(baseTemplateFile, 'utf8');
    let baseControlContent = fsSync.readFileSync(baseControlFile, 'utf8');
    let baseControlMobileContent = fsSync.readFileSync(baseControlMobileFile, 'utf8');
    
    // 종목명 치환 (기본 템플릿의 종목명을 새로운 종목명으로 변경)
    const baseTemplateNameLower = baseTemplateName.toLowerCase();
    const baseTemplateNameUpper = baseTemplateName.toUpperCase();
    const newTemplateNameLower = name.toLowerCase();
    const newTemplateNameUpper = name.toUpperCase();
    
    // 종목 코드 생성 (템플릿 이름을 기반으로 고유한 코드 생성)
    const sportCode = name.toUpperCase();
    
    // 치환할 패턴들 정의 (단어 경계를 사용하여 정확한 매칭)
    const replacementPatterns = [
      // overlay-images API 경로
      {
        pattern: new RegExp(`/api/overlay-images/${baseTemplateNameLower}\\b`, 'g'),
        replacement: `/api/overlay-images/${sportCode}`
      },
      {
        pattern: new RegExp(`/api/overlay-images/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/api/overlay-images/${sportCode}`
      },
      // team-logo-map API 경로
      {
        pattern: new RegExp(`/api/team-logo-map/${baseTemplateNameLower}\\b`, 'g'),
        replacement: `/api/team-logo-map/${sportCode}`
      },
      {
        pattern: new RegExp(`/api/team-logo-map/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/api/team-logo-map/${sportCode}`
      },
      // sport-overlay-images API 경로
      {
        pattern: new RegExp(`/api/sport-overlay-images-with-active/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/api/sport-overlay-images-with-active/${sportCode}`
      },
      {
        pattern: new RegExp(`/api/sport-active-overlay-image/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/api/sport-active-overlay-image/${sportCode}`
      },
      // overlay-images 폴더 경로
      {
        pattern: new RegExp(`/overlay-images/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/overlay-images/${sportCode}`
      },
      // 팀로고 사용 유무 API 경로 (축구 템플릿 기반인 경우)
      {
        pattern: new RegExp(`/api/soccer-team-logo-visibility/`, 'g'),
        replacement: `/api/team-logo-visibility/${newTemplateNameLower}/`
      }
    ];
    
    // 템플릿 파일에서 모든 패턴 치환
    replacementPatterns.forEach(({ pattern, replacement }) => {
      baseTemplateContent = baseTemplateContent.replace(pattern, replacement);
    });
    
    // 컨트롤 파일에서도 모든 패턴 치환
    replacementPatterns.forEach(({ pattern, replacement }) => {
      baseControlContent = baseControlContent.replace(pattern, replacement);
    });
    
    // 컨트롤 파일에서 팀로고 사용 유무 API 경로 추가 치환
    baseControlContent = baseControlContent.replace(
      /\/api\/soccer-team-logo-visibility/g,
      `/api/team-logo-visibility/${newTemplateNameLower}`
    );
    
    // 모바일 컨트롤 파일에서도 모든 패턴 치환
    replacementPatterns.forEach(({ pattern, replacement }) => {
      baseControlMobileContent = baseControlMobileContent.replace(pattern, replacement);
    });
    
    // 모바일 컨트롤 파일에서 팀로고 사용 유무 API 경로 추가 치환
    baseControlMobileContent = baseControlMobileContent.replace(
      /\/api\/soccer-team-logo-visibility/g,
      `/api/team-logo-visibility/${newTemplateNameLower}`
    );
    
    // 파일 복사 (템플릿과 컨트롤 파일 모두 복사)
    fsSync.writeFileSync(newTemplateFile, baseTemplateContent);
    fsSync.writeFileSync(newControlFile, baseControlContent);
    fsSync.writeFileSync(newControlMobileFile, baseControlMobileContent);

    // 데이터베이스에 템플릿 정보 저장
    const template = await Template.create({
      name,
      file_name: `${name}-template.ejs`,
      sport_type: name,
      template_type: 'overlay',
      content: '',
      is_default: false
    });

    logger.info(`새 템플릿 생성: ${name} (기본 템플릿: ${baseTemplateName}) - 템플릿, 컨트롤, 모바일 컨트롤 파일 모두 생성됨`);
    res.json(template);
  } catch (error) {
    logger.error('템플릿 생성 중 오류:', error);
    res.status(500).json({ error: '템플릿 생성에 실패했습니다.' });
  }
});

// 템플릿 목록 조회 API
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await Template.findAll();
    res.json(templates.map(template => ({
      id: template.id,
      name: template.name,
      templateFile: template.file_name || `${template.name}-template.ejs`,
      controlFile: template.file_name ? template.file_name.replace('-template.ejs', '-control.ejs') : `${template.name}-control.ejs`,
      controlMobileFile: template.file_name ? template.file_name.replace('-template.ejs', '-control-mobile.ejs') : `${template.name}-control-mobile.ejs`,
      isDefault: template.is_default || false
    })));
  } catch (error) {
    logger.error('템플릿 목록 조회 중 오류:', error);
    res.status(500).json({ error: '템플릿 목록을 불러오는데 실패했습니다.' });
  }
});

// 템플릿 삭제 API
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 데이터베이스에서 템플릿 찾기
    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    // 기본 템플릿은 삭제 불가
    if (template.is_default) {
      return res.status(400).json({ error: '기본 템플릿은 삭제할 수 없습니다.' });
    }

    // 템플릿 참조 관계 확인
    const referencedSports = await Sport.findAll({
      where: { template: template.name }
    });

    if (referencedSports.length > 0) {
      const sportNames = referencedSports.map(sport => sport.name).join(', ');
      return res.status(400).json({ 
        error: '이 템플릿을 사용하는 종목이 있습니다.',
        details: `다음 종목들이 이 템플릿을 사용하고 있습니다: ${sportNames}`,
        referencedSports: referencedSports.map(sport => ({
          id: sport.id,
          name: sport.name,
          code: sport.code
        }))
      });
    }
    
    const viewsDir = path.join(__dirname, 'views');
    const templateFile = path.join(viewsDir, `${template.name}-template.ejs`);
    const controlFile = path.join(viewsDir, `${template.name}-control.ejs`);
    const controlMobileFile = path.join(viewsDir, `${template.name}-control-mobile.ejs`);
    
    // 파일 삭제 (파일이 없어도 강제 삭제)
    const filesToDelete = [templateFile, controlFile, controlMobileFile];
    let deletedFiles = [];
    let missingFiles = [];
    
    for (const filePath of filesToDelete) {
      try {
        if (fsSync.existsSync(filePath)) {
          fsSync.unlinkSync(filePath);
          deletedFiles.push(path.basename(filePath));
        } else {
          missingFiles.push(path.basename(filePath));
        }
      } catch (error) {
        logger.warn(`템플릿 파일 삭제 실패: ${filePath}`, error.message);
        missingFiles.push(path.basename(filePath));
      }
    }
    
    // 데이터베이스에서 템플릿 삭제
    await template.destroy();
    
    // 로그 메시지 생성
    let logMessage = `템플릿 삭제: ${template.name}`;
    if (deletedFiles.length > 0) {
      logMessage += ` - 삭제된 파일: ${deletedFiles.join(', ')}`;
    }
    if (missingFiles.length > 0) {
      logMessage += ` - 누락된 파일: ${missingFiles.join(', ')}`;
    }
    if (deletedFiles.length === 0 && missingFiles.length > 0) {
      logMessage += ' (강제 삭제)';
    }
    
    logger.info(logMessage);
    res.json({ 
      success: true, 
      message: '템플릿이 성공적으로 삭제되었습니다.',
      deletedFiles: deletedFiles,
      missingFiles: missingFiles
    });
  } catch (error) {
    logger.error('템플릿 삭제 중 오류:', error);
    res.status(500).json({ error: '템플릿 삭제에 실패했습니다.' });
  }
});

// 템플릿 파일 관리 API
app.get('/api/templates/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 데이터베이스에서 템플릿 찾기
    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    const viewsDir = path.join(__dirname, 'views');
    const templateFile = path.join(viewsDir, `${template.name}-template.ejs`);
    const controlFile = path.join(viewsDir, `${template.name}-control.ejs`);
    const controlMobileFile = path.join(viewsDir, `${template.name}-control-mobile.ejs`);
    
    const files = [
      {
        name: 'template',
        displayName: '템플릿 파일',
        fileName: `${template.name}-template.ejs`,
        path: templateFile,
        exists: fsSync.existsSync(templateFile),
        size: fsSync.existsSync(templateFile) ? fsSync.statSync(templateFile).size : 0
      },
      {
        name: 'control',
        displayName: '컨트롤 파일',
        fileName: `${template.name}-control.ejs`,
        path: controlFile,
        exists: fsSync.existsSync(controlFile),
        size: fsSync.existsSync(controlFile) ? fsSync.statSync(controlFile).size : 0
      },
      {
        name: 'control-mobile',
        displayName: '모바일 컨트롤 파일',
        fileName: `${template.name}-control-mobile.ejs`,
        path: controlMobileFile,
        exists: fsSync.existsSync(controlMobileFile),
        size: fsSync.existsSync(controlMobileFile) ? fsSync.statSync(controlMobileFile).size : 0
      }
    ];

    res.json({ 
      template: template,
      files: files
    });
  } catch (error) {
    logger.error('템플릿 파일 정보 조회 중 오류:', error);
    res.status(500).json({ error: '템플릿 파일 정보 조회에 실패했습니다.' });
  }
});

// 템플릿 파일 다운로드 API
app.get('/api/templates/:id/files/:fileType/download', async (req, res) => {
  try {
    const { id, fileType } = req.params;
    
    // 데이터베이스에서 템플릿 찾기
    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    const viewsDir = path.join(__dirname, 'views');
    let filePath;
    let fileName;
    
    switch (fileType) {
      case 'template':
        filePath = path.join(viewsDir, `${template.name}-template.ejs`);
        fileName = `${template.name}-template.ejs`;
        break;
      case 'control':
        filePath = path.join(viewsDir, `${template.name}-control.ejs`);
        fileName = `${template.name}-control.ejs`;
        break;
      case 'control-mobile':
        filePath = path.join(viewsDir, `${template.name}-control-mobile.ejs`);
        fileName = `${template.name}-control-mobile.ejs`;
        break;
      default:
        return res.status(400).json({ error: '잘못된 파일 타입입니다.' });
    }

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    res.download(filePath, fileName);
  } catch (error) {
    logger.error('템플릿 파일 다운로드 중 오류:', error);
    res.status(500).json({ error: '파일 다운로드에 실패했습니다.' });
  }
});

// 템플릿 파일 업로드 API
const templateFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, 'views'));
    },
    filename: (req, file, cb) => {
      const { id, fileType } = req.params;
      const fileName = `${req.templateName}-${fileType}.ejs`;
      cb(null, fileName);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.ejs')) {
      cb(null, true);
    } else {
      cb(new Error('EJS 파일만 업로드 가능합니다.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

app.post('/api/templates/:id/files/:fileType/upload', async (req, res) => {
  try {
    const { id, fileType } = req.params;
    
    // 데이터베이스에서 템플릿 찾기
    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    // 기본 템플릿은 파일 수정 불가
    if (template.is_default) {
      return res.status(400).json({ error: '기본 템플릿의 파일은 수정할 수 없습니다.' });
    }

    req.templateName = template.name;
  } catch (error) {
    logger.error('템플릿 파일 업로드 중 오류:', error);
    res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }
}, templateFileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 선택되지 않았습니다.' });
    }

    logger.info(`템플릿 파일 업로드: ${req.templateName}-${req.params.fileType}.ejs`);
    res.json({ 
      success: true, 
      message: '파일이 성공적으로 업로드되었습니다.',
      fileName: req.file.filename
    });
  } catch (error) {
    logger.error('템플릿 파일 업로드 중 오류:', error);
    res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }
});

// 템플릿 파일 삭제 API
app.delete('/api/templates/:id/files/:fileType', async (req, res) => {
  try {
    const { id, fileType } = req.params;
    
    // 데이터베이스에서 템플릿 찾기
    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    // 기본 템플릿은 파일 삭제 불가
    if (template.is_default) {
      return res.status(400).json({ error: '기본 템플릿의 파일은 삭제할 수 없습니다.' });
    }

    const viewsDir = path.join(__dirname, 'views');
    let filePath;
    let fileName;
    
    switch (fileType) {
      case 'template':
        filePath = path.join(viewsDir, `${template.name}-template.ejs`);
        fileName = `${template.name}-template.ejs`;
        break;
      case 'control':
        filePath = path.join(viewsDir, `${template.name}-control.ejs`);
        fileName = `${template.name}-control.ejs`;
        break;
      case 'control-mobile':
        filePath = path.join(viewsDir, `${template.name}-control-mobile.ejs`);
        fileName = `${template.name}-control-mobile.ejs`;
        break;
      default:
        return res.status(400).json({ error: '잘못된 파일 타입입니다.' });
    }

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    fsSync.unlinkSync(filePath);
    
    logger.info(`템플릿 파일 삭제: ${fileName}`);
    res.json({ 
      success: true, 
      message: '파일이 성공적으로 삭제되었습니다.',
      fileName: fileName
    });
  } catch (error) {
    logger.error('템플릿 파일 삭제 중 오류:', error);
    res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
  }
});

// 종목 생성 API
app.post('/api/sport', requireAuth, async (req, res) => {
  try {
    const { name, code, template, description } = req.body;
    
    if (!name || !template) {
      return res.status(400).json({ error: '종목명과 템플릿은 필수입니다.' });
    }

    // 템플릿 존재 확인
    const existingTemplate = await Template.findOne({ where: { name: template } });
    if (!existingTemplate) {
      return res.status(400).json({ error: '존재하지 않는 템플릿입니다.' });
    }

    // 종목 코드 자동 생성 (템플릿 이름과 일치)
    const sportCode = template.toUpperCase();
    
    // 코드 중복 확인
    const existingSport = await Sport.findOne({ where: { code: sportCode } });
    if (existingSport) {
      return res.status(400).json({ error: '이미 존재하는 종목 코드입니다.' });
    }

    const sport = await Sport.create({
      name,
      code: sportCode,
      template,
      description,
      is_active: true,
      is_default: false,
      created_by: req.session.userId
    });

    logger.info(`새 종목 생성: ${name} (${sportCode}) by user ${req.session.username}`);
    res.json(sport);
  } catch (error) {
    logger.error('종목 생성 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 종목 삭제 전 관련 데이터 조회 API
app.get('/api/sport/:code/delete-info', async (req, res) => {
  try {
    const { code } = req.params;
    
    const sport = await Sport.findOne({ where: { code } });
    if (!sport) {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    // 기본 종목은 삭제 불가
    if (sport.is_default) {
      return res.status(400).json({ error: '기본 종목은 삭제할 수 없습니다.' });
    }

    // 관련 데이터 조회
    const matchCount = await Match.count({ where: { sport_type: sport.template } });
    const overlayImageCount = await SportOverlayImage.count({ where: { sport_code: code } });
    const activeOverlayImageCount = await SportActiveOverlayImage.count({ where: { sport_code: code } });
    
    // 오버레이 이미지 파일 목록 조회
    const overlayImages = await SportOverlayImage.findAll({ 
      where: { sport_code: code },
      attributes: ['filename', 'file_path']
    });
    
    // 오버레이 이미지 폴더 경로
    const overlayImageDir = path.join(__dirname, 'public', 'overlay-images', code);
    let overlayFolderExists = false;
    let overlayFolderSize = 0;
    
    try {
      if (fsSync.existsSync(overlayImageDir)) {
        overlayFolderExists = true;
        const files = fsSync.readdirSync(overlayImageDir);
        overlayFolderSize = files.length;
      }
    } catch (error) {
      console.warn('오버레이 이미지 폴더 확인 실패:', error.message);
    }

    // 팀로고 폴더 경로
    const teamLogoDir = path.join(__dirname, 'public', 'TEAMLOGO', code);
    let teamLogoFolderExists = false;
    let teamLogoFolderSize = 0;
    
    try {
      if (fsSync.existsSync(teamLogoDir)) {
        teamLogoFolderExists = true;
        const files = fsSync.readdirSync(teamLogoDir);
        teamLogoFolderSize = files.length;
      }
    } catch (error) {
      console.warn('팀로고 폴더 확인 실패:', error.message);
    }

    res.json({
      sport: {
        name: sport.name,
        code: sport.code,
        template: sport.template
      },
      relatedData: {
        matchCount,
        overlayImageCount,
        activeOverlayImageCount,
        overlayImages: overlayImages.map(img => ({
          filename: img.filename,
          file_path: img.file_path
        })),
        overlayFolderInfo: {
          exists: overlayFolderExists,
          fileCount: overlayFolderSize
        },
        teamLogoFolderInfo: {
          exists: teamLogoFolderExists,
          fileCount: teamLogoFolderSize
        }
      }
    });
  } catch (error) {
    logger.error('종목 삭제 정보 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 종목 삭제 API
app.delete('/api/sport/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const sport = await Sport.findOne({ where: { code } });
    if (!sport) {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    // 기본 종목은 삭제 불가
    if (sport.is_default) {
      return res.status(400).json({ error: '기본 종목은 삭제할 수 없습니다.' });
    }

    // 해당 종목의 경기가 있는지 확인
    const matchCount = await Match.count({ where: { sport_type: sport.template } });
    if (matchCount > 0) {
      return res.status(400).json({ 
        error: `이 종목으로 생성된 경기가 ${matchCount}개 있어 삭제할 수 없습니다. 먼저 관련 경기를 삭제해주세요.` 
      });
    }

    // 오버레이 이미지 관련 데이터 삭제
    await SportOverlayImage.destroy({ where: { sport_code: code } });
    await SportActiveOverlayImage.destroy({ where: { sport_code: code } });
    
    // 오버레이 이미지 폴더 삭제
    const overlayImageDir = path.join(__dirname, 'public', 'overlay-images', code);
    try {
      if (fsSync.existsSync(overlayImageDir)) {
        fsSync.rmSync(overlayImageDir, { recursive: true, force: true });
        logger.info(`오버레이 이미지 폴더 삭제: ${overlayImageDir}`);
      }
    } catch (error) {
      logger.warn(`오버레이 이미지 폴더 삭제 실패: ${overlayImageDir}`, error.message);
    }

    // 팀로고 폴더 삭제
    const teamLogoDir = path.join(__dirname, 'public', 'TEAMLOGO', code);
    try {
      if (fsSync.existsSync(teamLogoDir)) {
        fsSync.rmSync(teamLogoDir, { recursive: true, force: true });
        logger.info(`팀로고 폴더 삭제: ${teamLogoDir}`);
      }
    } catch (error) {
      logger.warn(`팀로고 폴더 삭제 실패: ${teamLogoDir}`, error.message);
    }

    // 종목 삭제
    await sport.destroy();
    logger.info(`종목 삭제: ${sport.name} (${code}) - 관련 데이터 모두 삭제됨`);
    res.json({ success: true });
  } catch (error) {
    logger.error('종목 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 종목 수정 API
app.put('/api/sport/:code', async (req, res) => {
  try {
    const sport = await Sport.findOne({ where: { code: req.params.code } });
    if (!sport) {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    const { name, code, template, description } = req.body;
    
    if (!name || !code || !template) {
      return res.status(400).json({ error: '종목명, 코드, 템플릿은 필수입니다.' });
    }

    // 기본 종목은 수정 제한
    if (sport.is_default) {
      return res.status(400).json({ error: '기본 종목은 수정할 수 없습니다.' });
    }

    // 코드 중복 확인 (자신 제외)
    if (code !== sport.code) {
      const existingSport = await Sport.findOne({ where: { code } });
      if (existingSport) {
        return res.status(400).json({ error: '이미 존재하는 종목 코드입니다.' });
      }
    }

    // 템플릿이 존재하는지 확인
    const existingTemplate = await Template.findOne({ where: { name: template } });
    if (!existingTemplate) {
      return res.status(400).json({ error: '존재하지 않는 템플릿입니다.' });
    }

    await sport.update({ name, code, template, description });
    logger.info(`종목 수정: ${sport.id} - ${name} (${code})`);
    res.json(sport);
  } catch (error) {
    logger.error('종목 수정 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 목록 조회 API
app.get('/api/matches', requireAuth, async (req, res) => {
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
    const sports = await Sport.findAll();
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
});

// 동적 컨트롤 패널 라우트
app.get('/:sport/:id/control', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 스포츠 타입이 일치하는지 확인
    if (match.sport_type.toLowerCase() !== req.params.sport.toLowerCase()) {
      return res.status(400).json({ error: '잘못된 스포츠 타입입니다.' });
    }

    // 경기 데이터가 없는 경우에만 초기화
    if (!match.match_data) {
      match.match_data = {
        state: '경기 전',
        home_shots: 0,
        away_shots: 0,
        home_shots_on_target: 0,
        away_shots_on_target: 0,
        home_corners: 0,
        away_corners: 0,
        home_fouls: 0,
        away_fouls: 0
      };
      await match.save();
    }

    // 기존 점수 유지
    const homeScore = match.home_score || 0;
    const awayScore = match.away_score || 0;
    
    // 기본 팀 컬러 가져오기
    const defaultColors = await getDefaultTeamColors();
    
    // 야구 경기인 경우 team_logo_map.json에서 팀 컬러 정보 가져오기
    let teamColors = {
      home: defaultColors.home,
      away: defaultColors.away
    };
    
    if (req.params.sport.toLowerCase() === 'baseball') {
      try {
        const logoMapPath = path.join(__dirname, 'public/TEAMLOGO/BASEBALL/team_logo_map.json');
        if (fsSync.existsSync(logoMapPath)) {
          const logoMapContent = await fs.readFile(logoMapPath, 'utf8');
          const logoMapData = JSON.parse(logoMapContent);
          
          if (logoMapData.teamLogoMap) {
            // 홈팀 컬러 정보
            const homeTeamInfo = logoMapData.teamLogoMap[match.home_team];
            if (homeTeamInfo && homeTeamInfo.teamColor) {
              teamColors.home = homeTeamInfo.teamColor;
            }
            
            // 원정팀 컬러 정보
            const awayTeamInfo = logoMapData.teamLogoMap[match.away_team];
            if (awayTeamInfo && awayTeamInfo.teamColor) {
              teamColors.away = awayTeamInfo.teamColor;
            }
          }
        }
      } catch (error) {
        logger.warn('team_logo_map.json 읽기 실패, 기본 컬러 사용:', error.message);
      }
    }
    
    // URL 생성
    const mobileUrl = `http://localhost:3000/${req.params.sport}/${req.params.id}/control-mobile`;
    const overlayUrl = `http://localhost:3000/${req.params.sport}/${req.params.id}/overlay`;
    
    // 해당 스포츠의 컨트롤 템플릿 렌더링
    res.render(`${req.params.sport}-control`, { 
      match: {
        ...match.toJSON(),
        home_score: homeScore,
        away_score: awayScore
      },
      mobileUrl: mobileUrl,
      overlayUrl: overlayUrl,
      defaultColors,
      teamColors  // team_logo_map.json에서 가져온 실제 팀 컬러
    });
  } catch (error) {
    logger.error('컨트롤 패널 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 리스트별 모바일 컨트롤 페이지 (구체적인 라우트를 먼저 배치)
app.get('/list/:id/control-mobile', async (req, res) => {
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
    
    // 디버깅 로그 추가
    logger.info(`리스트 모바일 컨트롤 렌더링: listId=${id}, matchId=${match.id}, sport_type=${match.sport_type}, template=${match.sport_type}-control-mobile`);
    
    // sport_type이 없으면 기본값 설정
    const sportType = match.sport_type || 'soccer';
    
    res.render(`${sportType}-control-mobile`, { 
      match: match,
      listId: id,
      listName: list.name,
      currentMatchIndex: matchIndex,
      totalMatches: list.matches.length
    });
  } catch (error) {
    logger.error('리스트 모바일 컨트롤 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 동적 모바일 컨트롤 패널 라우트 (일반적인 라우트는 나중에 배치)
app.get('/:sport/:id/control-mobile', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 스포츠 타입이 일치하는지 확인
    if (match.sport_type.toLowerCase() !== req.params.sport.toLowerCase()) {
      return res.status(400).json({ error: '잘못된 스포츠 타입입니다.' });
    }

    // 기존 점수 유지
    const homeScore = match.home_score || 0;
    const awayScore = match.away_score || 0;
    
    // 기본 팀 컬러 가져오기
    const defaultColors = await getDefaultTeamColors();
    
    // URL 생성
    const mobileUrl = `http://localhost:3000/${req.params.sport}/${req.params.id}/control-mobile`;
    const overlayUrl = `http://localhost:3000/${req.params.sport}/${req.params.id}/overlay`;
    
    // 해당 스포츠의 모바일 컨트롤 템플릿 렌더링
    res.render(`${req.params.sport}-control-mobile`, { 
      match: {
        ...match.toJSON(),
        home_score: homeScore,
        away_score: awayScore
      },
      mobileUrl: mobileUrl,
      overlayUrl: overlayUrl,
      defaultColors
    });
  } catch (error) {
    logger.error('모바일 컨트롤 패널 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그 관리 API
app.get('/api/logs', (req, res) => {
  try {
    const logFiles = [];
    const files = fsSync.readdirSync(logDir);
    
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = fsSync.statSync(filePath);
        logFiles.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
        });
      }
    });
    
    res.json({
      success: true,
      logs: logFiles,
      logDir: logDir
    });
  } catch (error) {
    logger.error('로그 파일 목록 조회 실패:', error);
    res.status(500).json({ error: '로그 조회 실패' });
  }
});

// 로그 파일 다운로드 API
// 자동 로그 관리 상태 확인 API (더 구체적인 라우트를 먼저 정의)
app.get('/api/logs/auto-management-status', (req, res) => {
  console.log('자동 로그 관리 상태 API 호출됨');
  try {
    const autoBackupDir = path.join(__dirname, 'logs', 'auto-backup');
    let backupCount = 0;
    let totalBackupSize = 0;
    let oldestBackup = null;
    let newestBackup = null;
    
    if (fsSync.existsSync(autoBackupDir)) {
      const backupFolders = fsSync.readdirSync(autoBackupDir);
      backupCount = backupFolders.length;
      
      if (backupCount > 0) {
        const backupDates = [];
        
        backupFolders.forEach(folder => {
          const folderPath = path.join(autoBackupDir, folder);
          const stats = fsSync.statSync(folderPath);
          backupDates.push(stats.mtime);
          
          // 폴더 내 파일들의 크기 계산
          if (fsSync.existsSync(folderPath)) {
            const files = fsSync.readdirSync(folderPath);
            files.forEach(file => {
              const filePath = path.join(folderPath, file);
              const fileStats = fsSync.statSync(filePath);
              totalBackupSize += fileStats.size;
            });
          }
        });
        
        // 가장 오래된 백업과 가장 최근 백업 찾기
        if (backupDates.length > 0) {
          oldestBackup = new Date(Math.min(...backupDates));
          newestBackup = new Date(Math.max(...backupDates));
        }
      }
    }
    
    // 현재 로그 파일 크기 계산
    let currentLogSize = 0;
    const logFiles = ['app.log', 'error.log'];
    logFiles.forEach(logFile => {
      const logFilePath = path.join(logDir, logFile);
      if (fsSync.existsSync(logFilePath)) {
        currentLogSize += fsSync.statSync(logFilePath).size;
      }
    });
    
    res.json({
      success: true,
      data: {
        backupCount: backupCount,
        totalBackupSize: totalBackupSize,
        currentLogSize: currentLogSize,
        oldestBackup: oldestBackup,
        newestBackup: newestBackup,
        maxLogSize: 10 * 1024 * 1024, // 10MB
        autoBackupEnabled: true
      }
    });
  } catch (error) {
    console.error('자동 로그 관리 상태 조회 중 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '자동 로그 관리 상태 조회에 실패했습니다.' 
    });
  }
});

app.get('/api/logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(logDir, filename);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    res.download(filePath);
  } catch (error) {
    logger.error('로그 파일 다운로드 실패:', error);
    res.status(500).json({ error: '로그 다운로드 실패' });
  }
});

// 로그 파일 초기화 API
app.delete('/api/logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(logDir, filename);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    // 파일 내용을 빈 문자열로 초기화
    fsSync.writeFileSync(filePath, '');
    logger.info(`로그 파일 초기화: ${filename}`);
    
    res.json({ success: true, message: '로그 파일의 내용이 초기화되었습니다.' });
  } catch (error) {
    logger.error('로그 파일 초기화 실패:', error);
    res.status(500).json({ error: '로그 초기화 실패' });
  }
});

// 로그 백업 API
app.post('/api/logs/backup', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'logs', 'backup', timestamp);
    
    if (!fsSync.existsSync(backupDir)) {
      fsSync.mkdirSync(backupDir, { recursive: true });
    }
    
    const files = fsSync.readdirSync(logDir);
    let backedUpFiles = 0;
    
    files.forEach(file => {
      if (file.endsWith('.log') && !file.includes('backup')) {
        const sourcePath = path.join(logDir, file);
        const destPath = path.join(backupDir, file);
        fsSync.copyFileSync(sourcePath, destPath);
        backedUpFiles++;
      }
    });
    
    logger.info(`로그 백업 완료: ${backedUpFiles}개 파일, 경로: ${backupDir}`);
    
    res.json({
      success: true,
      message: `${backedUpFiles}개 로그 파일이 백업되었습니다.`,
      backupPath: backupDir
    });
  } catch (error) {
    logger.error('로그 백업 실패:', error);
    res.status(500).json({ error: '로그 백업 실패' });
  }
});

// 로그 정리 API (오래된 로그 삭제)
app.post('/api/logs/cleanup', (req, res) => {
  try {
    const { days = 30 } = req.body; // 기본 30일
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const files = fsSync.readdirSync(logDir);
    let deletedFiles = 0;
    
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = fsSync.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fsSync.unlinkSync(filePath);
          deletedFiles++;
        }
      }
    });
    
    logger.info(`로그 정리 완료: ${deletedFiles}개 파일 삭제 (${days}일 이전)`);
    
    res.json({
      success: true,
      message: `${deletedFiles}개 오래된 로그 파일이 삭제되었습니다.`
    });
  } catch (error) {
    logger.error('로그 정리 실패:', error);
    res.status(500).json({ error: '로그 정리 실패' });
  }
});

// 경기 점수 CSV 다운로드 API (전체)
app.get('/api/matches/score-csv', async (req, res) => {
  try {
    logger.info('전체 경기 CSV 다운로드 요청 시작');
    
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });
    
    logger.info(`조회된 경기 수: ${matches.length}`);
    
    // CSV 헤더
    let csvContent = '팀명,점수,점수,팀명\n';
    
    // 각 경기 데이터를 CSV 형식으로 변환
    matches.forEach(match => {
      const homeTeam = match.home_team || '홈팀';
      const awayTeam = match.away_team || '원정팀';
      const homeScore = match.home_score || 0;
      const awayScore = match.away_score || 0;
      
      // CSV 행 추가 (팀명,점수,점수,팀명 형식)
      csvContent += `${homeTeam},${homeScore},${awayScore},${awayTeam}\n`;
    });
    
    // CSV 파일 다운로드 응답
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="all_matches_score_${new Date().toISOString().split('T')[0]}.csv"`);
    
    // BOM 추가 (한글 깨짐 방지)
    const bom = '\uFEFF';
    res.send(bom + csvContent);
    
    logger.info(`전체 경기 점수 CSV 다운로드 완료: ${matches.length}개 경기`);
  } catch (error) {
    logger.error('경기 점수 CSV 다운로드 실패:', error);
    res.status(500).json({ error: 'CSV 다운로드 중 오류가 발생했습니다.' });
  }
});

// 경기 리스트별 점수 CSV 다운로드 API
app.get('/api/matches/score-csv-by-lists', async (req, res) => {
  try {
    logger.info('구장별 CSV 다운로드 요청 시작');
    
    // 모든 경기 리스트 조회
    const matchLists = await MatchList.findAll({
      order: [['name', 'ASC']]
    });
    
    logger.info(`조회된 경기 리스트 수: ${matchLists.length}`);
    
    // 모든 경기 데이터 조회
    const allMatches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });
    
    logger.info(`조회된 경기 수: ${allMatches.length}`);
    
    // 경기 ID를 키로 하는 맵 생성
    const matchMap = new Map();
    allMatches.forEach(match => {
      matchMap.set(match.id, match);
    });
    
    // CSV 헤더
    let csvContent = '구장,팀명,점수,점수,팀명\n';
    
    // 각 리스트별로 경기 데이터 추가
    matchLists.forEach(list => {
      logger.info(`리스트 처리 중: ${list.name}, matches 타입: ${typeof list.matches}`);
      
      let matches = list.matches;
      
      // matches가 문자열인 경우 JSON 파싱 시도
      if (typeof matches === 'string') {
        try {
          matches = JSON.parse(matches);
        } catch (parseError) {
          logger.error(`리스트 ${list.name}의 matches JSON 파싱 실패:`, parseError);
          matches = [];
        }
      }
      
      if (matches && Array.isArray(matches) && matches.length > 0) {
        // 리스트 구분선 추가
        csvContent += `\n# ${list.name}\n`;
        
        // 해당 리스트의 경기들 추가
        matches.forEach(listMatch => {
          const match = matchMap.get(listMatch.id);
          if (match) {
            const homeTeam = match.home_team || '홈팀';
            const awayTeam = match.away_team || '원정팀';
            const homeScore = match.home_score || 0;
            const awayScore = match.away_score || 0;
            
            // CSV 행 추가 (구장,팀명,점수,점수,팀명 형식)
            csvContent += `${list.name},${homeTeam},${homeScore},${awayScore},${awayTeam}\n`;
          }
        });
      }
    });
    
    // 리스트에 없는 경기들도 추가 (기타 구장으로 분류)
    const usedMatchIds = new Set();
    matchLists.forEach(list => {
      let matches = list.matches;
      
      // matches가 문자열인 경우 JSON 파싱 시도
      if (typeof matches === 'string') {
        try {
          matches = JSON.parse(matches);
        } catch (parseError) {
          matches = [];
        }
      }
      
      if (matches && Array.isArray(matches)) {
        matches.forEach(listMatch => {
          usedMatchIds.add(listMatch.id);
        });
      }
    });
    
    const unusedMatches = allMatches.filter(match => !usedMatchIds.has(match.id));
    if (unusedMatches.length > 0) {
      csvContent += `\n# 기타 구장\n`;
      unusedMatches.forEach(match => {
        const homeTeam = match.home_team || '홈팀';
        const awayTeam = match.away_team || '원정팀';
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        
        csvContent += `기타,${homeTeam},${homeScore},${awayScore},${awayTeam}\n`;
      });
    }
    
    // CSV 파일 다운로드 응답
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="matches_by_venue_${new Date().toISOString().split('T')[0]}.csv"`);
    
    // BOM 추가 (한글 깨짐 방지)
    const bom = '\uFEFF';
    res.send(bom + csvContent);
    
    logger.info(`구장별 경기 점수 CSV 다운로드 완료: ${matchLists.length}개 구장, ${allMatches.length}개 경기`);
  } catch (error) {
    logger.error('구장별 경기 점수 CSV 다운로드 실패:', error);
    res.status(500).json({ error: 'CSV 다운로드 중 오류가 발생했습니다.' });
  }
});

// 로그 내용 읽기 API
app.get('/api/logs/:filename/content', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(logDir, filename);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    // 파일 크기 확인 (너무 큰 파일은 읽지 않음)
    const stats = fsSync.statSync(filePath);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > maxSize) {
      return res.status(413).json({ 
        error: '파일이 너무 큽니다. 다운로드하여 확인하세요.',
        size: stats.size,
        maxSize: maxSize
      });
    }
    
    const content = fsSync.readFileSync(filePath, 'utf8');
    
    res.json({
      success: true,
      content: content,
      size: stats.size,
      lines: content.split('\n').length
    });
  } catch (error) {
    logger.error('로그 내용 읽기 실패:', error);
    res.status(500).json({ error: '로그 내용 읽기 실패' });
  }
});

// 모든 로그 초기화 API
app.delete('/api/logs/clear-all', (req, res) => {
  try {
    const files = fsSync.readdirSync(logDir);
    let clearedFiles = 0;
    
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        // 파일 내용을 빈 문자열로 초기화
        fsSync.writeFileSync(filePath, '');
        clearedFiles++;
      }
    });
    
    logger.info(`모든 로그 초기화 완료: ${clearedFiles}개 파일 초기화`);
    
    res.json({
      success: true,
      message: `${clearedFiles}개 로그 파일의 내용이 모두 초기화되었습니다.`
    });
  } catch (error) {
    logger.error('모든 로그 초기화 실패:', error);
    res.status(500).json({ error: '모든 로그 초기화 실패' });
  }
});

// 팀 위치 변경 API
app.post('/api/match/:id/swap-teams', async (req, res) => {
  try {
    const { id } = req.params;
    
    const match = await Match.findByPk(id);
    if (!match) {
      return res.status(404).json({ success: false, error: '경기를 찾을 수 없습니다.' });
    }
    
    // 팀 정보 교환
    const tempHomeTeam = match.home_team;
    const tempHomeScore = match.home_score;
    const tempHomeColor = match.home_team_color;
    const tempHomeLogo = match.home_team_logo;
    
    await match.update({
      home_team: match.away_team,
      home_score: match.away_score,
      home_team_color: match.away_team_color,
      home_team_logo: match.away_team_logo,
      away_team: tempHomeTeam,
      away_score: tempHomeScore,
      away_team_color: tempHomeColor,
      away_team_logo: tempHomeLogo
    });
    
    // 소켓을 통해 실시간 업데이트 전송
    io.to(`match_${id}`).emit('teamsSwapped', {
      matchId: id,
      home_team: match.home_team,
      away_team: match.away_team,
      home_score: match.home_score,
      away_score: match.away_score,
      home_team_color: match.home_team_color,
      away_team_color: match.away_team_color,
      home_team_logo: match.home_team_logo,
      away_team_logo: match.away_team_logo
    });
    
    logger.info(`팀 위치 변경: ${id} 경기`);
    
    res.json({
      success: true,
      message: '팀 위치가 성공적으로 변경되었습니다.'
    });
  } catch (error) {
    logger.error('팀 위치 변경 실패:', error);
    res.status(500).json({ success: false, error: '팀 위치 변경 중 오류가 발생했습니다.' });
  }
});

// 팀명 업데이트 API
app.post('/api/match/:id/team-name', async (req, res) => {
  try {
    const { id } = req.params;
    const { team, teamName, currentLogoPath, currentLogoBgColor, currentTeamColor } = req.body;
    
    if (!team || !teamName) {
      return res.status(400).json({ success: false, error: '팀 정보와 팀명이 필요합니다.' });
    }
    
    const match = await Match.findByPk(id);
    if (!match) {
      return res.status(404).json({ success: false, error: '경기를 찾을 수 없습니다.' });
    }
    
    // 기존 팀명 저장
    const oldTeamName = team === 'home' ? match.home_team : match.away_team;
    
    // 팀명 업데이트
    if (team === 'home') {
      match.home_team = teamName;
    } else if (team === 'away') {
      match.away_team = teamName;
    } else {
      return res.status(400).json({ success: false, error: '잘못된 팀 정보입니다.' });
    }
    
    await match.save();
    
    // team_logo_map.json 업데이트 (야구 경기인 경우)
    if (match.sport_type === 'BASEBALL') {
      try {
        const logoMapPath = path.join(__dirname, 'public/TEAMLOGO/BASEBALL/team_logo_map.json');
        
        // 기존 파일 읽기
        let teamLogoMap = {};
        if (fsSync.existsSync(logoMapPath)) {
          const fileContent = await fs.readFile(logoMapPath, 'utf8');
          const parsed = JSON.parse(fileContent);
          teamLogoMap = parsed.teamLogoMap || {};
        }
        
        // 기존 팀명의 로고 정보가 있으면 새 팀명으로 이동
        if (teamLogoMap[oldTeamName]) {
          const logoInfo = teamLogoMap[oldTeamName];
          
          // 새 팀명으로 로고 정보 복사 (현재 선택된 정보 우선 사용)
          teamLogoMap[teamName] = {
            path: currentLogoPath || logoInfo.path || '',
            bgColor: currentLogoBgColor || logoInfo.bgColor || '#ffffff',
            teamColor: currentTeamColor || logoInfo.teamColor || '#1e40af',
            name: teamName
          };
          
          // 기존 팀명 삭제
          delete teamLogoMap[oldTeamName];
          
          // 파일 저장
          const updatedData = {
            sport: 'BASEBALL',
            teamLogoMap: teamLogoMap
          };
          
          await fs.writeFile(logoMapPath, JSON.stringify(updatedData, null, 2), 'utf8');
          logger.info(`팀명 변경으로 인한 로고 정보 업데이트: ${oldTeamName} → ${teamName}`);
        } else {
          // 기존 팀명의 로고 정보가 없으면 새 팀명으로 현재 선택된 정보로 생성
          teamLogoMap[teamName] = {
            path: currentLogoPath || '',
            bgColor: currentLogoBgColor || '#ffffff',
            teamColor: currentTeamColor || '#1e40af',
            name: teamName
          };
          
          // 파일 저장
          const updatedData = {
            sport: 'BASEBALL',
            teamLogoMap: teamLogoMap
          };
          
          await fs.writeFile(logoMapPath, JSON.stringify(updatedData, null, 2), 'utf8');
          logger.info(`새 팀명으로 로고 정보 생성: ${teamName}`);
        }
      } catch (logoError) {
        logger.error('team_logo_map.json 업데이트 중 오류:', logoError);
        // 로고 맵 업데이트 실패해도 팀명 업데이트는 계속 진행
      }
    }
    
    // 소켓을 통해 실시간 업데이트 전송
    io.to(`match_${id}`).emit('teamNameUpdated', {
      matchId: id,
      team: team,
      teamName: teamName
    });
    
    logger.info(`팀명 업데이트: ${id} 경기 ${team}팀 -> ${teamName}`);
    
    res.json({
      success: true,
      message: '팀명이 성공적으로 업데이트되었습니다.',
      data: {
        matchId: id,
        team: team,
        teamName: teamName
      }
    });
  } catch (error) {
    logger.error('팀명 업데이트 실패:', error);
    res.status(500).json({ success: false, error: '팀명 업데이트 중 오류가 발생했습니다.' });
  }
});

// 백업 복원 API (파일 업로드 또는 서버 백업 선택)
app.post('/api/backup/restore', requireAuth, backupUpload.single('backupFile'), async (req, res) => {
  try {
    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다.' });
    }

    const uploadedFile = req.file;
    const { fileName } = req.body;

    // 파일 업로드 또는 서버 백업 선택 확인
    if (!uploadedFile && !fileName) {
      return res.status(400).json({ success: false, error: '백업 파일을 업로드하거나 서버의 백업을 선택해주세요.' });
    }

    if (uploadedFile && fileName) {
      return res.status(400).json({ success: false, error: '파일 업로드와 서버 백업 중 하나만 선택해주세요.' });
    }

    let result;
    let backupName;

    if (uploadedFile) {
      // 파일 업로드 방식
      backupName = uploadedFile.originalname;
      logger.info(`백업 복원 시작 (파일 업로드): ${backupName} (사용자: ${req.session.username})`);

      result = await backupManager.restoreFromFile(uploadedFile.path);
      
      // 업로드된 임시 파일 삭제
      fsSync.unlinkSync(uploadedFile.path);
    } else {
      // 서버 백업 선택 방식
      backupName = fileName;
      logger.info(`백업 복원 시작 (서버 백업): ${backupName} (사용자: ${req.session.username})`);

      const backupPath = path.join(__dirname, 'backups', fileName);
      if (!fsSync.existsSync(backupPath)) {
        return res.status(404).json({ success: false, error: '백업 파일을 찾을 수 없습니다.' });
      }

      result = await backupManager.restoreFromFile(backupPath);
    }

    if (result.success) {
      logger.info(`백업 복원 완료: ${backupName} (사용자: ${req.session.username})`);
      res.json({ 
        success: true, 
        message: '백업이 성공적으로 복원되었습니다.',
        data: result.data
      });
    } else {
      logger.error(`백업 복원 실패: ${backupName} - ${result.error}`);
      res.status(500).json({ 
        success: false, 
        error: result.error || '백업 복원 중 오류가 발생했습니다.' 
      });
    }
  } catch (error) {
    logger.error('백업 복원 API 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '백업 복원 중 오류가 발생했습니다.' 
    });
  }
});


// 리스트 정보 확인 API (디버깅용)
app.get('/api/debug/list/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const list = await MatchList.findByPk(id);
    
    if (!list) {
      return res.status(404).json({ error: '리스트를 찾을 수 없습니다.' });
    }
    
    res.json({
      success: true,
      list: {
        id: list.id,
        name: list.name,
        matches: list.matches,
        matchCount: list.matches ? list.matches.length : 0
      }
    });
  } catch (error) {
    logger.error('리스트 정보 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 현재 푸시된 경기 정보 확인 API
app.get('/api/pushed-match/:listId', (req, res) => {
  try {
    const { listId } = req.params;
    const pushedMatch = pushedMatches.get(listId);
    
    if (pushedMatch) {
      res.json({
        success: true,
        data: pushedMatch
      });
    } else {
      res.json({
        success: false,
        data: null
      });
    }
  } catch (error) {
    logger.error('푸시된 경기 정보 조회 실패:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
});

// 커스텀 URL 통합 오버레이 페이지
app.get('/overlay/:customUrl', async (req, res) => {
  try {
    const { customUrl } = req.params;
    
    console.log(`[DEBUG] 커스텀 URL 통합 오버레이 요청: customUrl=${customUrl}`);
    
    const list = await MatchList.findOne({ where: { custom_url: customUrl } });
    
    if (!list) {
      console.log(`[DEBUG] 커스텀 URL로 리스트를 찾을 수 없음: ${customUrl}`);
      return res.status(404).send('리스트를 찾을 수 없습니다.');
    }
    
    console.log(`[DEBUG] 커스텀 URL로 리스트 찾음: ${list.name}, ID: ${list.id}`);
    
    // 기존 로직과 동일하게 처리
    if (!list.matches || list.matches.length === 0) {
      console.log(`[DEBUG] 리스트에 등록된 경기가 없음`);
      return res.status(404).send('리스트에 등록된 경기가 없습니다.');
    }
    
    // 마지막 푸시된 경기 정보 확인 후 사용
    let currentMatch = list.matches[0];
    let currentMatchIndex = 0;
    
    // 마지막 푸시된 경기 정보 확인
    const pushedMatch = pushedMatches.get(list.id);
    if (pushedMatch && pushedMatch.matchId) {
        // 푸시된 경기가 리스트에 있는지 확인
        const pushedMatchInList = list.matches.find(match => match.id === pushedMatch.matchId);
        if (pushedMatchInList) {
            currentMatch = pushedMatchInList;
            currentMatchIndex = list.matches.findIndex(match => match.id === pushedMatch.matchId);
            console.log(`[DEBUG] 마지막 푸시된 경기 사용: ${pushedMatch.matchId}, 인덱스: ${currentMatchIndex}`);
        }
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
      home_team_color: actualMatch.home_team_color || '#1e40af',
      away_team_color: actualMatch.away_team_color || '#1e40af',
      match_data: {
        state: matchData.state || '전반',
        timer: matchData.timer || 0,
        isRunning: matchData.isRunning || false,
        ...matchData  // 모든 match_data 정보 포함
      }
    };
    
    console.log(`[DEBUG] 커스텀 URL 통합 오버레이 경기 데이터 생성: ${match.id}, sport_type: ${match.sport_type}`);
    
    res.render('unified-overlay', { 
      matchId: match.id,
      sport_type: match.sport_type,
      listId: list.id,
      listName: list.name,
      currentMatchIndex: currentMatchIndex,
      totalMatches: list.matches.length,
      isListMode: true
    });
  } catch (error) {
    console.error('[DEBUG] 커스텀 URL 통합 오버레이 로드 실패:', error);
    logger.error('커스텀 URL 통합 오버레이 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 통합 오버레이 페이지 (통합 컨트롤 패널에서 푸시한 경기용)
app.get('/unified/:listId/overlay', async (req, res) => {
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
    
    // 마지막 푸시된 경기 정보 확인 후 사용
    let currentMatch = list.matches[0];
    let currentMatchIndex = 0;
    
    // 마지막 푸시된 경기 정보 확인
    const pushedMatch = pushedMatches.get(listId);
    if (pushedMatch && pushedMatch.matchId) {
        // 푸시된 경기가 리스트에 있는지 확인
        const pushedMatchInList = list.matches.find(match => match.id === pushedMatch.matchId);
        if (pushedMatchInList) {
            currentMatch = pushedMatchInList;
            currentMatchIndex = list.matches.findIndex(match => match.id === pushedMatch.matchId);
            console.log(`[DEBUG] 마지막 푸시된 경기 사용: ${pushedMatch.matchId}, 인덱스: ${currentMatchIndex}`);
        }
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
      home_team_color: actualMatch.home_team_color || '#1e40af',
      away_team_color: actualMatch.away_team_color || '#1e40af',
      match_data: {
        state: matchData.state || '전반',
        timer: matchData.timer || 0,
        isRunning: matchData.isRunning || false,
        ...matchData  // 모든 match_data 정보 포함
      }
    };
    
    console.log(`[DEBUG] 통합 오버레이 경기 데이터 생성: ${match.id}, sport_type: ${match.sport_type}`);
    
    res.render('unified-overlay', { 
      matchId: match.id,
      sport_type: match.sport_type,
      listId: listId,
      listName: list.name,
      currentMatchIndex: currentMatchIndex,
      totalMatches: list.matches.length,
      isListMode: true
    });
  } catch (error) {
    console.error('[DEBUG] 통합 오버레이 로드 실패:', error);
    logger.error('통합 오버레이 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 커스텀 URL 설정 API
app.post('/api/list/:id/custom-url', async (req, res) => {
  try {
    const { id } = req.params;
    const { customUrl } = req.body;
    
    if (!customUrl || customUrl.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: '커스텀 URL을 입력해주세요.' 
      });
    }
    
    // URL 형식 검증 (영문, 숫자, 하이픈, 언더스코어만 허용)
    const urlPattern = /^[a-zA-Z0-9_-]+$/;
    if (!urlPattern.test(customUrl)) {
      return res.status(400).json({ 
        success: false, 
        error: '커스텀 URL은 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.' 
      });
    }
    
    // 중복 URL 확인 (자기 자신 제외)
    const existingList = await MatchList.findOne({ where: { custom_url: customUrl } });
    if (existingList && existingList.id != id) {
      return res.status(400).json({ 
        success: false, 
        error: '이미 사용 중인 커스텀 URL입니다.' 
      });
    }
    
    // 자기 자신의 기존 URL과 동일한 경우는 허용
    if (existingList && existingList.id == id) {
      return res.json({ 
        success: true, 
        message: '커스텀 URL이 이미 설정되어 있습니다.',
        customUrl: customUrl,
        overlayUrl: `/overlay/${customUrl}`
      });
    }
    
    const list = await MatchList.findByPk(id);
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        error: '리스트를 찾을 수 없습니다.' 
      });
    }
    
    // 커스텀 URL 업데이트
    list.custom_url = customUrl;
    await list.save();
    
    logger.info(`커스텀 URL 설정 완료: listId=${id}, customUrl=${customUrl}`);
    
    res.json({ 
      success: true, 
      message: '커스텀 URL이 설정되었습니다.',
      customUrl: customUrl,
      overlayUrl: `/overlay/${customUrl}`
    });
  } catch (error) {
    logger.error('커스텀 URL 설정 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 커스텀 URL 삭제 API
app.delete('/api/list/:id/custom-url', async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await MatchList.findByPk(id);
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        error: '리스트를 찾을 수 없습니다.' 
      });
    }
    
    // 커스텀 URL 삭제
    list.custom_url = null;
    await list.save();
    
    logger.info(`커스텀 URL 삭제 완료: listId=${id}`);
    
    res.json({ 
      success: true, 
      message: '커스텀 URL이 삭제되었습니다.' 
    });
  } catch (error) {
    logger.error('커스텀 URL 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 경기 리스트별 오버레이 페이지 (더 구체적인 라우트를 먼저 배치)
app.get('/list/:id/overlay', async (req, res) => {
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
    
    const matchIndex = parseInt(index);
    if (matchIndex < 0 || matchIndex >= list.matches.length) {
      console.log(`[DEBUG] 잘못된 경기 인덱스: ${matchIndex}, 총 경기 수: ${list.matches.length}`);
      return res.status(400).send('잘못된 경기 인덱스입니다.');
    }
    
    const currentMatch = list.matches[matchIndex];
    console.log(`[DEBUG] 현재 경기 정보:`, currentMatch);
    
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
      home_team_color: actualMatch.home_team_color || '#1e40af',
      away_team_color: actualMatch.away_team_color || '#1e40af',
      match_data: {
        state: matchData.state || '전반',
        timer: matchData.timer || 0,
        isRunning: matchData.isRunning || false,
        ...matchData  // 모든 match_data 정보 포함
      }
    };
    
    console.log(`[DEBUG] 경기 데이터 생성: ${match.id}, sport_type: ${match.sport_type}`);
    
    // 스포츠 타입에 따라 적절한 템플릿 선택
    const sportType = currentMatch.sport_type || 'soccer';
    const templateName = `${sportType}-template`;
    
    console.log(`[DEBUG] 템플릿 선택: ${templateName}`);
    
    res.render(templateName, { 
      match: match,
      listId: id,
      listName: list.name,
      currentMatchIndex: matchIndex,
      totalMatches: list.matches.length,
      isListMode: true  // 리스트 모드 플래그 추가
    });
  } catch (error) {
    console.error('[DEBUG] 리스트 오버레이 로드 실패:', error);
    logger.error('리스트 오버레이 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 동적 오버레이 라우트
app.get('/:sport/:id/overlay', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    // 스포츠 타입이 일치하는지 확인
    if (match.sport_type.toLowerCase() !== req.params.sport.toLowerCase()) {
      return res.status(400).json({ error: '잘못된 스포츠 타입입니다.' });
    }
    
    // 해당 스포츠의 오버레이 템플릿 렌더링
    res.render(`${req.params.sport}-template`, { 
      match: match,
      isListMode: false,  // 원본 오버레이는 리스트 모드가 아님
      listId: null,
      listName: null,
      currentMatchIndex: 0,
      totalMatches: 0
    });
  } catch (error) {
    logger.error('오버레이 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 리스트 관리 페이지
app.get('/match-list-manager', requireAuth, (req, res) => {
  res.render('match-list-manager');
});

// 팀 로고 매핑 정보 가져오기 API
app.get('/api/team-logo-map/:sportType', async (req, res) => {
    try {
        const sportType = req.params.sportType.toUpperCase();
        const logoDir = path.join(__dirname, 'public/TEAMLOGO', sportType);
        const teamLogoMapPath = path.join(logoDir, 'team_logo_map.json');

        // 디렉토리가 없으면 생성
        if (!fsSync.existsSync(logoDir)) {
            fsSync.mkdirSync(logoDir, { recursive: true });
        }

        // 파일이 없으면 빈 객체로 초기화
        if (!fsSync.existsSync(teamLogoMapPath)) {
            const initialData = {
                teamLogoMap: {}
            };
            fsSync.writeFileSync(teamLogoMapPath, JSON.stringify(initialData, null, 2), 'utf8');
            return res.json(initialData);
        }

        // 파일 읽기
        const data = JSON.parse(fsSync.readFileSync(teamLogoMapPath, 'utf8'));
        res.json(data);
    } catch (error) {
        logger.error('팀 로고 매핑 정보 조회 중 오류 발생:', error);
        res.status(500).json({
            error: '팀 로고 매핑 정보 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 팀 로고 목록 조회 API
app.get('/api/team-logos/:sportType', async (req, res) => {
    try {
        const sportType = req.params.sportType.toUpperCase();
        const logoDir = path.join(__dirname, 'public/TEAMLOGO', sportType);
        
        // 디렉토리가 없으면 빈 배열 반환
        if (!fsSync.existsSync(logoDir)) {
            return res.json({ logos: [] });
        }

        // 디렉토리 내의 모든 파일 읽기
        const files = fsSync.readdirSync(logoDir);
        const logoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
        });

        // 로고 정보 배열 생성
        const logos = logoFiles.map(file => {
            const filePath = path.join(logoDir, file);
            const stats = fsSync.statSync(filePath);
            const fileName = path.parse(file).name; // 확장자 제거한 파일명
            
            return {
                fileName: file,
                displayName: fileName,
                path: `/TEAMLOGO/${sportType}/${file}`,
                size: stats.size,
                modified: stats.mtime
            };
        });

        // 파일명으로 정렬
        logos.sort((a, b) => a.displayName.localeCompare(b.displayName));

        res.json({ logos });
    } catch (error) {
        logger.error('팀 로고 목록 조회 중 오류 발생:', error);
        res.status(500).json({
            error: '팀 로고 목록 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 탭별 경기 일괄 삭제 API (현재 탭에 표시된 경기들만 삭제)
app.delete('/api/matches/by-tab', requireAuth, async (req, res) => {
  try {
    const { matchIds, tabType, tabName } = req.body;
    
    if (!matchIds || !Array.isArray(matchIds) || matchIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '삭제할 경기 ID 목록이 필요합니다.'
      });
    }
    
    logger.info(`=== ${tabName} 탭 경기 데이터 삭제 시작 (사용자: ${req.session.username}, 권한: ${req.session.userRole}) ===`);
    logger.info(`삭제할 경기 ID 목록: ${matchIds.join(', ')}`);
    
    let whereCondition = { id: matchIds };
    let deletedMatches = 0;
    let deletedLists = 0;
    
    // 일반 사용자는 자신이 만든 경기와 리스트만 삭제 가능
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
      logger.info(`${tabName} 탭 일반 사용자 삭제: 사용자 ID ${req.session.userId}의 데이터만 삭제`);
    } else {
      logger.info(`${tabName} 탭 관리자 삭제: 모든 데이터 삭제`);
    }
    
    // 해당 경기들 삭제
    deletedMatches = await Match.destroy({
      where: whereCondition,
      truncate: false
    });
    
    // MatchList는 경기 목록을 관리하는 것이므로 개별 경기 삭제 시에는 삭제하지 않음
    // 대신 MatchList의 matches JSON 배열에서 해당 경기 ID들을 제거
    if (matchIds.length > 0) {
      const matchLists = await MatchList.findAll();
      for (const matchList of matchLists) {
        if (matchList.matches && Array.isArray(matchList.matches)) {
          const updatedMatches = matchList.matches.filter(matchId => !matchIds.includes(matchId));
          if (updatedMatches.length !== matchList.matches.length) {
            await matchList.update({ matches: updatedMatches });
            deletedLists++;
          }
        }
      }
    }
    
    const message = req.session.userRole === 'admin' 
      ? `${tabName} 탭의 모든 경기 데이터가 삭제되었습니다. (경기 ${deletedMatches}개, 리스트 ${deletedLists}개)`
      : `${tabName} 탭의 본인이 만든 경기 데이터가 삭제되었습니다. (경기 ${deletedMatches}개, 리스트 ${deletedLists}개)`;
    
    logger.info(`${tabName} 탭 경기 데이터 삭제 완료: 경기 ${deletedMatches}개, 리스트 ${deletedLists}개 삭제됨 (사용자: ${req.session.username})`);
    
    res.json({
      success: true,
      message: message,
      deletedMatches,
      deletedLists,
      tabType,
      tabName,
      requestedMatchIds: matchIds
    });
  } catch (error) {
    logger.error(`${req.body.tabName} 탭 경기 데이터 삭제 실패:`, error);
    res.status(500).json({
      success: false,
      error: '탭별 경기 데이터 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 모든 경기 데이터 삭제 API
app.delete('/api/matches/all', requireAuth, async (req, res) => {
  try {
    logger.info(`=== 경기 데이터 삭제 시작 (사용자: ${req.session.username}, 권한: ${req.session.userRole}) ===`);
    
    let whereCondition = {};
    let deletedMatches = 0;
    let deletedLists = 0;
    
    // 일반 사용자는 자신이 만든 경기와 리스트만 삭제 가능
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
      logger.info(`일반 사용자 삭제: 사용자 ID ${req.session.userId}의 데이터만 삭제`);
    } else {
      logger.info('관리자 삭제: 모든 데이터 삭제');
    }
    
    // 경기 삭제
    deletedMatches = await Match.destroy({
      where: whereCondition,
      truncate: false
    });
    
    // 리스트 삭제
    deletedLists = await MatchList.destroy({
      where: whereCondition,
      truncate: false
    });
    
    // 푸시된 경기 정보 초기화 (관리자만)
    if (req.session.userRole === 'admin') {
      pushedMatches.clear();
    }
    
    const message = req.session.userRole === 'admin' 
      ? `모든 경기 데이터가 삭제되었습니다. (경기 ${deletedMatches}개, 리스트 ${deletedLists}개)`
      : `본인이 만든 경기 데이터가 삭제되었습니다. (경기 ${deletedMatches}개, 리스트 ${deletedLists}개)`;
    
    logger.info(`경기 데이터 삭제 완료: 경기 ${deletedMatches}개, 리스트 ${deletedLists}개 삭제됨 (사용자: ${req.session.username})`);
    
    res.json({
      success: true,
      message: message,
      deletedMatches,
      deletedLists
    });
  } catch (error) {
    logger.error('경기 데이터 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 삭제 API
app.delete('/api/match/:id', requireAuth, async (req, res) => {
    try {
        const match = await Match.findByPk(req.params.id);
        if (!match) {
            return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
        }

        // 일반 사용자는 자신이 만든 경기만 삭제 가능
        if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
            return res.status(403).json({ error: '이 경기를 삭제할 권한이 없습니다.' });
        }

        await match.destroy();
        logger.info(`경기 삭제 완료: ${match.id} (사용자: ${req.session.username})`);
        res.json({ success: true, message: '경기가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        logger.error('경기 삭제 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 모바일 전용 축구 컨트롤 패널 라우트
app.get('/soccer-control-mobile/:id', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).send('경기를 찾을 수 없습니다.');
    }
    res.render('soccer-control-mobile', { match });
  } catch (error) {
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 모바일 전용 야구 컨트롤 패널 라우트
app.get('/baseball-control-mobile/:id', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).send('경기를 찾을 수 없습니다.');
    }
    res.render('baseball-control-mobile', { match });
  } catch (error) {
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 모든 축구 경기의 팀컬러를 일괄 변경 (관리자용)
app.post('/admin/update-all-soccer-team-colors', async (req, res) => {
  const { color } = req.body; // 예: "#00cc33"
  if (!color) return res.status(400).json({ error: 'color 값이 필요합니다.' });

  try {
    // 모든 축구 경기 조회
    const matches = await Match.findAll({ where: { sport_type: 'SOCCER' } });
    for (const match of matches) {
      // match_data도 함께 업데이트
      const matchData = match.match_data || {};
      matchData.home_team_color = color;
      matchData.away_team_color = color;

      await match.update({
        home_team_color: color,
        away_team_color: color,
        match_data: matchData
      });
    }
    res.json({ success: true, count: matches.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 설정 API - 설정 조회
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.findAll();
    const settingsObj = {};
    
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    logger.error('설정 조회 실패:', error);
    res.status(500).json({ error: '설정 조회에 실패했습니다.' });
  }
});

// 설정 API - 설정 저장
app.post('/api/settings', async (req, res) => {
  try {
    const { default_home_color, default_away_color } = req.body;
    
    // 홈팀 기본 컬러 설정
    if (default_home_color) {
      await Settings.upsert({
        key: 'default_home_color',
        value: default_home_color,
        description: '홈팀 기본 컬러'
      });
    }
    
    // 원정팀 기본 컬러 설정
    if (default_away_color) {
      await Settings.upsert({
        key: 'default_away_color',
        value: default_away_color,
        description: '원정팀 기본 컬러'
      });
    }
    
    res.json({ success: true, message: '설정이 저장되었습니다.' });
  } catch (error) {
    logger.error('설정 저장 실패:', error);
    res.status(500).json({ error: '설정 저장에 실패했습니다.' });
  }
});

// 설정 페이지 라우트
app.get('/settings', (req, res) => {
  res.render('settings');
});

// 백업/복원 관리자 인스턴스 생성
const backupManager = new BackupRestoreManager();

// 백업 생성 API
app.post('/api/backup/create', requireAuth, async (req, res) => {
  try {
    // 관리자만 백업 생성 가능
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const { name } = req.body;
    const backupName = name ? name.trim() : undefined;
    
    logger.info(`백업 생성 시작 (사용자: ${req.session.username}${backupName ? `, 이름: ${backupName}` : ''})`);
    const result = await backupManager.createBackup(backupName);
    
    if (result.success) {
      logger.info(`백업 생성 완료: ${result.fileName} (${result.size} bytes)`);
      res.json(result);
    } else {
      logger.error(`백업 생성 실패: ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('백업 생성 오류:', error);
    res.status(500).json({ error: '백업 생성 중 오류가 발생했습니다.' });
  }
});

// 백업 목록 조회 API
app.get('/api/backup/list', requireAuth, async (req, res) => {
  try {
    // 관리자만 백업 목록 조회 가능
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const backupList = await backupManager.getBackupList();
    res.json(backupList);
  } catch (error) {
    logger.error('백업 목록 조회 오류:', error);
    res.status(500).json({ error: '백업 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 백업 파일 다운로드 API
app.get('/api/backup/download/:fileName', requireAuth, async (req, res) => {
  try {
    // 관리자만 백업 다운로드 가능
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const fileName = req.params.fileName;
    const filePath = path.join(backupManager.backupDir, fileName);
    
    // 파일 존재 확인
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: '백업 파일을 찾을 수 없습니다.' });
    }

    logger.info(`백업 파일 다운로드: ${fileName} (사용자: ${req.session.username})`);
    res.download(filePath, fileName);
  } catch (error) {
    logger.error('백업 파일 다운로드 오류:', error);
    res.status(500).json({ error: '백업 파일 다운로드 중 오류가 발생했습니다.' });
  }
});

// 백업 파일 삭제 API
app.delete('/api/backup/:fileName', requireAuth, async (req, res) => {
  try {
    // 관리자만 백업 삭제 가능
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const fileName = req.params.fileName;
    const result = await backupManager.deleteBackup(fileName);
    
    if (result.success) {
      logger.info(`백업 파일 삭제: ${fileName} (사용자: ${req.session.username})`);
      res.json(result);
    } else {
      logger.error(`백업 파일 삭제 실패: ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('백업 파일 삭제 오류:', error);
    res.status(500).json({ error: '백업 파일 삭제 중 오류가 발생했습니다.' });
  }
});

// 백업 복원 API
app.post('/api/backup/restore', requireAuth, async (req, res) => {
  try {
    // 관리자만 백업 복원 가능
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: '백업 파일명이 필요합니다.' });
    }

    const filePath = path.join(backupManager.backupDir, fileName);
    
    logger.info(`백업 복원 시작: ${fileName} (사용자: ${req.session.username})`);
    const result = await backupManager.restoreBackup(filePath);
    
    if (result.success) {
      logger.info(`백업 복원 완료: ${fileName}`);
      res.json(result);
    } else {
      logger.error(`백업 복원 실패: ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('백업 복원 오류:', error);
    res.status(500).json({ error: '백업 복원 중 오류가 발생했습니다.' });
  }
});

// 경기 리스트 API - 리스트 조회
app.get('/api/match-lists', requireAuth, async (req, res) => {
  try {
    let whereCondition = {};
    
    // 일반 사용자는 자신이 만든 리스트만 볼 수 있음
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
    }
    
    const lists = await MatchList.findAll({
      where: whereCondition,
      order: [['created_at', 'DESC']]
    });
    
    logger.info(`리스트 조회 (사용자: ${req.session.username}, 권한: ${req.session.userRole}):`, lists.length + '개');
    res.json(lists);
  } catch (error) {
    logger.error('리스트 조회 실패:', error);
    res.status(500).json({ error: '리스트 조회에 실패했습니다.' });
  }
});

// 경기 리스트 API - 리스트 생성
app.post('/api/match-lists', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '리스트 이름이 필요합니다.' });
    }
    
    const trimmedName = name.trim();
    
    // 동일한 이름의 리스트가 있는지 확인
    const existingList = await MatchList.findOne({ 
      where: { name: trimmedName } 
    });
    
    if (existingList) {
      // 리스트를 만든 사용자 정보 조회
      const creator = await User.findByPk(existingList.created_by);
      const creatorName = creator ? creator.username : '알 수 없음';
      
      // 리스트에 포함된 경기 수 계산
      const matchCount = existingList.matches ? existingList.matches.length : 0;
      
      return res.status(400).json({ 
        error: `'${trimmedName}' 이름이 이미 사용 중입니다.`,
        details: {
          creator: creatorName,
          matchCount: matchCount,
          listId: existingList.id,
          message: `사용자 '${creatorName}'이(가) 만든 리스트에서 사용 중입니다. (경기 ${matchCount}개 포함)`
        }
      });
    }
    
    const list = await MatchList.create({
      name: trimmedName,
      matches: [],
      created_by: req.session.userId
    });
    
    logger.info(`새 리스트 생성: ${trimmedName} (사용자: ${req.session.username})`);
    res.json(list);
  } catch (error) {
    logger.error('리스트 생성 실패:', error);
    res.status(500).json({ error: '리스트 생성에 실패했습니다.' });
  }
});

// 경기 리스트 API - 리스트 수정
app.put('/api/match-lists/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, matches } = req.body;
    
    const list = await MatchList.findByPk(id);
    if (!list) {
      return res.status(404).json({ error: '리스트를 찾을 수 없습니다.' });
    }
    
    // 일반 사용자는 자신이 만든 리스트만 수정 가능
    if (req.session.userRole !== 'admin' && parseInt(list.created_by) !== parseInt(req.session.userId)) {
      logger.warn(`리스트 수정 권한 거부: 리스트 ID ${id}, 리스트 생성자 ${list.created_by}, 요청자 ${req.session.userId} (${req.session.username})`);
      return res.status(403).json({ error: '이 리스트를 수정할 권한이 없습니다.' });
    }
    
    if (name !== undefined) {
      const trimmedName = name.trim();
      
      // 이름이 변경되는 경우 중복 검사
      if (trimmedName !== list.name) {
        const existingList = await MatchList.findOne({ 
          where: { 
            name: trimmedName,
            id: { [Op.ne]: id } // 자기 자신 제외
          } 
        });
        
        if (existingList) {
          // 리스트를 만든 사용자 정보 조회
          const creator = await User.findByPk(existingList.created_by);
          const creatorName = creator ? creator.username : '알 수 없음';
          
          // 리스트에 포함된 경기 수 계산
          const matchCount = existingList.matches ? existingList.matches.length : 0;
          
          return res.status(400).json({ 
            error: `'${trimmedName}' 이름이 이미 사용 중입니다.`,
            details: {
              creator: creatorName,
              matchCount: matchCount,
              listId: existingList.id,
              message: `사용자 '${creatorName}'이(가) 만든 리스트에서 사용 중입니다. (경기 ${matchCount}개 포함)`
            }
          });
        }
      }
      
      list.name = trimmedName;
    }
    if (matches !== undefined) {
      list.matches = matches;
    }
    
    await list.save();
    logger.info(`리스트 수정: ${list.name} (사용자: ${req.session.username})`);
    res.json(list);
  } catch (error) {
    logger.error('리스트 수정 실패:', error);
    res.status(500).json({ error: '리스트 수정에 실패했습니다.' });
  }
});

// 경기 리스트 API - 리스트 삭제
app.delete('/api/match-lists/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await MatchList.findByPk(id);
    if (!list) {
      return res.status(404).json({ error: '리스트를 찾을 수 없습니다.' });
    }
    
    // 일반 사용자는 자신이 만든 리스트만 삭제 가능
    if (req.session.userRole !== 'admin' && parseInt(list.created_by) !== parseInt(req.session.userId)) {
      logger.warn(`리스트 삭제 권한 거부: 리스트 ID ${id}, 리스트 생성자 ${list.created_by}, 요청자 ${req.session.userId} (${req.session.username})`);
      return res.status(403).json({ error: '이 리스트를 삭제할 권한이 없습니다.' });
    }
    
    await list.destroy();
    logger.info(`리스트 삭제: ${list.name} (사용자: ${req.session.username})`);
    res.json({ success: true });
  } catch (error) {
    logger.error('리스트 삭제 실패:', error);
    res.status(500).json({ error: '리스트 삭제에 실패했습니다.' });
  }
});




// 경기 리스트 API - 현재 경기 정보 조회
app.get('/api/list/:id/current-match', async (req, res) => {
  try {
    const { id } = req.params;
    const { index = 0 } = req.query;
    
    const list = await MatchList.findByPk(id);
    if (!list || !list.matches || list.matches.length === 0) {
      return res.status(404).json({ error: '리스트를 찾을 수 없습니다.' });
    }
    
    const matchIndex = parseInt(index);
    if (matchIndex < 0 || matchIndex >= list.matches.length) {
      return res.status(400).json({ error: '잘못된 경기 인덱스입니다.' });
    }
    
    const currentMatch = list.matches[matchIndex];
    const match = await Match.findByPk(currentMatch.id);
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    res.json({
      match: match,
      currentIndex: matchIndex,
      totalMatches: list.matches.length,
      listName: list.name
    });
  } catch (error) {
    logger.error('현재 경기 정보 조회 실패:', error);
    res.status(500).json({ error: '경기 정보 조회에 실패했습니다.' });
  }
});

// 404 에러 핸들러 추가
app.use((req, res, next) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 전역 에러 핸들러 추가
app.use((err, req, res, next) => {
  logger.error('서버 오류:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 메모리 최적화를 위한 캐시 관리
const matchDataCache = new Map();
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30분마다 캐시 정리
const MAX_CACHE_SIZE = 100; // 최대 캐시 크기

// 캐시 정리 함수
function cleanupCache() {
    try {
        const now = Date.now();
        const cacheTimeout = 10 * 60 * 1000; // 10분
        
        // 오래된 캐시 항목 제거
        for (const [key, value] of matchDataCache.entries()) {
            if (now - value.timestamp > cacheTimeout) {
                matchDataCache.delete(key);
            }
        }
        
        // 캐시 크기 제한
        if (matchDataCache.size > MAX_CACHE_SIZE) {
            const entries = Array.from(matchDataCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
            toDelete.forEach(([key]) => matchDataCache.delete(key));
        }
        
        logger.info(`캐시 정리 완료: ${matchDataCache.size}개 항목 유지`);
    } catch (error) {
        logger.error('캐시 정리 중 오류:', error);
    }
}

// 캐시 정리 스케줄러 시작
setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);

// 성능 모니터링
const performanceMetrics = {
    activeMatches: 0,
    activeConnections: 0,
    dbUpdatesPerSecond: 0,
    memoryUsage: 0,
    lastUpdate: Date.now()
};

// 성능 메트릭 업데이트 함수
function updatePerformanceMetrics() {
    try {
        performanceMetrics.activeMatches = matchTimerData.size;
        performanceMetrics.activeConnections = io.engine.clientsCount;
        performanceMetrics.memoryUsage = process.memoryUsage();
        performanceMetrics.lastUpdate = Date.now();
        
        // 5분마다 성능 로그 출력
        if (Date.now() % (5 * 60 * 1000) < 1000) {
            logger.info('성능 메트릭:', {
                activeMatches: performanceMetrics.activeMatches,
                activeConnections: performanceMetrics.activeConnections,
                memoryUsage: {
                    rss: Math.round(performanceMetrics.memoryUsage.rss / 1024 / 1024) + 'MB',
                    heapUsed: Math.round(performanceMetrics.memoryUsage.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(performanceMetrics.memoryUsage.heapTotal / 1024 / 1024) + 'MB'
                },
                pendingDbUpdates: pendingDbUpdates.size,
                cacheSize: matchDataCache.size
            });
        }
    } catch (error) {
        logger.error('성능 메트릭 업데이트 오류:', error);
    }
}

// 성능 모니터링 스케줄러 (10초마다)
setInterval(updatePerformanceMetrics, 10000);

// 성능 모니터링 API 엔드포인트
app.get('/api/performance', (req, res) => {
    try {
        res.json({
            activeMatches: performanceMetrics.activeMatches,
            activeConnections: performanceMetrics.activeConnections,
            memoryUsage: {
                rss: Math.round(performanceMetrics.memoryUsage.rss / 1024 / 1024),
                heapUsed: Math.round(performanceMetrics.memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(performanceMetrics.memoryUsage.heapTotal / 1024 / 1024)
            },
            pendingDbUpdates: pendingDbUpdates.size,
            cacheSize: matchDataCache.size,
            lastUpdate: performanceMetrics.lastUpdate
        });
    } catch (error) {
        logger.error('성능 모니터링 API 오류:', error);
        res.status(500).json({ error: '성능 정보를 가져올 수 없습니다.' });
    }
});
