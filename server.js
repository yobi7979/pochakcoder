const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const { sequelize, Match, Settings, MatchList } = require('./models');
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
  level: 'debug',
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
    // 콘솔 출력
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            // sportType이 없으면 기본값으로 'SOCCER' 사용
            const sportType = req.body.sportType || 'SOCCER';
            const dir = path.join(__dirname, 'public', 'TEAMLOGO', sportType);
            if (!fsSync.existsSync(dir)) {
                fsSync.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            // 원본 파일명을 안전하게 처리
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            cb(null, originalName);
        }
    }),
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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static('views'));

// 세션 설정
app.use(session({
  secret: 'sports-coder-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // 개발 환경에서는 false로 설정
}));

// 타이머 상태 저장
const matchTimers = new Map();
const matchLastUpdateTime = new Map();

// 타이머 관리 함수
function startMatchTimer(matchId) {
    let timer = matchTimers.get(matchId);
    
    if (!timer) {
        // 타이머가 없으면 새로 생성
        timer = {
            interval: null,
            currentSeconds: 0,
            isRunning: false
        };
        matchTimers.set(matchId, timer);
    }
    
    // 타이머가 이미 실행 중이면 리턴
    if (timer.isRunning && timer.interval) {
        return;
    }
    
    // 타이머 시작
    timer.isRunning = true;
    matchLastUpdateTime.set(matchId, Date.now());
    
    // interval이 없으면 새로 생성
    if (!timer.interval) {
        timer.interval = setInterval(() => {
            timer.currentSeconds++;
            matchLastUpdateTime.set(matchId, Date.now());
            io.to(`match_${matchId}`).emit('timer_update', {
                currentSeconds: timer.currentSeconds,
                isRunning: true,
                lastUpdateTime: Date.now()
            });
        }, 1000);
    }
}

function stopMatchTimer(matchId) {
    const timer = matchTimers.get(matchId);
    if (timer) {
        if (timer.interval) {
            clearInterval(timer.interval);
            timer.interval = null;
        }
        timer.isRunning = false;
        matchLastUpdateTime.set(matchId, Date.now());
    }
}

function resetMatchTimer(matchId) {
    const timer = matchTimers.get(matchId);
    if (timer) {
        if (timer.interval) {
            clearInterval(timer.interval);
            timer.interval = null;
        }
        timer.currentSeconds = 0;
        timer.isRunning = false;
        matchLastUpdateTime.set(matchId, Date.now());
    }
}

function setMatchTimer(matchId, minutes, seconds) {
    let timer = matchTimers.get(matchId);
    
    if (!timer) {
        // 타이머가 없으면 새로 생성
        timer = {
            interval: null,
            currentSeconds: 0,
            isRunning: false
        };
        matchTimers.set(matchId, timer);
    }
    
    timer.currentSeconds = minutes * 60 + seconds;
    matchLastUpdateTime.set(matchId, Date.now());
}

// 서버 시작 시 저장된 타이머 상태 복원
async function restoreMatchTimers() {
    try {
        const matches = await Match.findAll();
        for (const match of matches) {
            const matchData = match.match_data || {};
            const lastUpdate = matchData.lastUpdateTime || Date.now();
            const currentTime = Date.now();
            const timeDiff = Math.floor((currentTime - lastUpdate) / 1000);
            
            // 타이머 객체 생성 (실행하지는 않음)
            let timer = matchTimers.get(match.id);
            if (!timer) {
                timer = {
                    interval: null,
                    currentSeconds: 0,
                    isRunning: false
                };
                matchTimers.set(match.id, timer);
            }
            
            // 저장된 타이머 값이 있으면 사용, 없으면 0으로 설정
            timer.currentSeconds = matchData.timer || 0;
            
            // 타이머가 실행 중이었다면 경과 시간 추가하고 실제로 시작
            if (matchData.isRunning) {
                timer.currentSeconds += timeDiff;
                timer.isRunning = true;
                matchLastUpdateTime.set(match.id, Date.now());
                
                // 실제 타이머 시작
                if (!timer.interval) {
                    timer.interval = setInterval(() => {
                        timer.currentSeconds++;
                        matchLastUpdateTime.set(match.id, Date.now());
                        io.to(`match_${match.id}`).emit('timer_update', {
                            currentSeconds: timer.currentSeconds,
                            isRunning: true,
                            lastUpdateTime: Date.now()
                        });
                    }, 1000);
                }
            } else {
                // 실행 중이 아니었다면 타이머 정지 상태로 설정
                timer.isRunning = false;
                if (timer.interval) {
                    clearInterval(timer.interval);
                    timer.interval = null;
                }
            }
        }
        }
        logger.info('타이머 상태 복원 완료');
    } catch (error) {
        logger.error('타이머 복원 중 오류 발생:', error);
    }
}

// 라우트 설정
app.get('/', (req, res) => {
  res.redirect('/matches');
});

// 경기 목록 페이지
app.get('/matches', async (req, res) => {
  try {
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });
    logger.info('경기 목록 조회:', matches);
    res.render('matches', { matches });
  } catch (error) {
    logger.error('경기 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 생성 페이지
app.get('/matches/new', async (req, res) => {
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
app.post('/api/match', async (req, res) => {
  try {
    const { sport_type, home_team, away_team, match_data } = req.body;
    
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
      url
    });

    // 타이머 초기화
    startMatchTimer(match.id);

    // 모든 종목에 대해 컨트롤러와 오버레이 URL 생성
    const overlay_url = `/${sport_type.toLowerCase()}/${match.id}/overlay`;
    const control_url = `/${sport_type.toLowerCase()}/${match.id}/control`;

    const matchData = match.toJSON();

    
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
    const { sport_type, home_team, away_team } = req.body;
    
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
    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    }

    // 로고 파일 경로 생성 (public 폴더 기준 상대 경로)
    // 원본 파일명을 안전하게 인코딩하여 경로 생성
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const logoPath = `/TEAMLOGO/BASEBALL/${originalName}`;
    
    res.json({ 
      success: true, 
      logoPath: logoPath,
      message: '로고가 성공적으로 업로드되었습니다.'
    });
    
    logger.info(`팀 로고 업로드 성공: ${logoPath}, 팀: ${req.body.teamName}, 타입: ${req.body.teamType}`);
  } catch (error) {
    logger.error('로고 업로드 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오버레이 이미지 업로드 API
app.post('/api/overlay-image', overlayImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    }

    // 이미지 파일 경로 생성 (public 폴더 기준 상대 경로)
    const imagePath = `/overlay-images/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      imagePath: imagePath,
      filename: req.file.filename,
      message: '오버레이 이미지가 성공적으로 업로드되었습니다.'
    });
    
    // 모든 축구 오버레이 페이지에 실시간으로 반영하기 위해 소켓 이벤트 발송
    io.emit('overlay_image_updated', { 
      action: 'uploaded',
      imagePath: imagePath,
      filename: req.file.filename
    });
    
    logger.info(`오버레이 이미지 업로드 성공: ${imagePath}`);
  } catch (error) {
    logger.error('오버레이 이미지 업로드 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오버레이 이미지 목록 조회 API
app.get('/api/overlay-images', async (req, res) => {
  try {
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
  } catch (error) {
    logger.error('오버레이 이미지 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오버레이 이미지 삭제 API
app.delete('/api/overlay-image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'public', 'overlay-images', filename);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
    }
    
    fsSync.unlinkSync(filePath);
    
    res.json({ 
      success: true, 
      message: '이미지가 성공적으로 삭제되었습니다.'
    });
    
    // 모든 축구 오버레이 페이지에 실시간으로 반영하기 위해 소켓 이벤트 발송
    io.emit('overlay_image_updated', { 
      action: 'deleted',
      filename: filename
    });
    
    logger.info(`오버레이 이미지 삭제 성공: ${filename}`);
  } catch (error) {
    logger.error('오버레이 이미지 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 축구 오버레이 디자인 설정 조회 API
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

// 축구 오버레이 디자인 설정 저장 API
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
    
    // 기존 푸시 정보 삭제
    pushedMatches.delete(listId);
    
    // 모든 리스트 오버레이 클라이언트에게 새로고침 알림
    const roomName = `list_overlay_${listId}`;
    io.to(roomName).emit('overlay_force_refresh', { 
      listId: listId,
      timestamp: Date.now()
    });
    
    res.json({ 
      success: true, 
      message: '오버레이 URL이 강제 새로고침되었습니다.'
    });
    
    logger.info(`오버레이 URL 강제 새로고침: ${listId}`);
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
    // 로고 매핑 데이터 확인
    const { sportType, teamLogoMap } = req.body;
    if (!sportType || !teamLogoMap) {
      return res.status(400).json({ error: '필수 데이터가 누락되었습니다.' });
    }

    // 종목별 디렉토리 생성
    const logoDir = path.join(__dirname, 'public/TEAMLOGO', sportType);
    if (!fsSync.existsSync(logoDir)) {
      fsSync.mkdirSync(logoDir, { recursive: true });
    }

    // JSON 파일 저장
    const logoMapPath = path.join(logoDir, 'team_logo_map.json');
    await fs.writeFile(logoMapPath, JSON.stringify({
      sport: sportType,
      teamLogoMap: teamLogoMap
    }, null, 2), 'utf8');

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

    // join 이벤트 처리
    socket.on('join', (matchId) => {
        const roomName = `match_${matchId}`;
        socket.join(roomName);
        logger.info(`클라이언트 ${socket.id}가 방 ${roomName}에 참가함`);
    });

    // 타이머 상태 요청 이벤트 처리
    socket.on('request_timer_state', async (data) => {
        try {
            const { matchId } = data;
            logger.info(`타이머 상태 요청: matchId=${matchId}`);
            
            // 경기 데이터에서 타이머 정보 가져오기
            const match = await Match.findByPk(matchId);
            if (!match) {
                throw new Error('경기를 찾을 수 없습니다.');
            }
            
            const matchData = match.match_data || {};
            const currentSeconds = matchData.currentSeconds || matchData.timer || 0;
            const isRunning = matchData.isRunning || false;
            
            // 클라이언트에게 현재 타이머 상태 전송
            socket.emit('timer_state', {
                matchId: matchId,
                currentSeconds: currentSeconds,
                isRunning: isRunning,
                lastUpdateTime: Date.now()
            });
            
            logger.info(`타이머 상태 전송 완료: matchId=${matchId}, currentSeconds=${currentSeconds}, isRunning=${isRunning}`);
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
                let timer = matchTimers.get(matchId);
                if (!timer) {
                    setMatchTimer(matchId, minutes, seconds);
                    timer = matchTimers.get(matchId);
                }
                if (timer) {
                    timer.currentSeconds = minutes * 60 + seconds;
                    matchLastUpdateTime.set(matchId, Date.now());
                }
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
                let timer = matchTimers.get(matchId);
                if (!timer) {
                    startMatchTimer(matchId);
                    timer = matchTimers.get(matchId);
                }
                if (timer) {
                    timer.currentSeconds = currentSeconds;
                    timer.isRunning = true;
                    matchLastUpdateTime.set(matchId, Date.now());
                }
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
                
                // 서버 측 타이머 정지 (현재 시간으로 설정)
                let timer = matchTimers.get(matchId);
                if (timer) {
                    timer.currentSeconds = currentSeconds;
                    timer.isRunning = false;
                    if (timer.interval) {
                        clearInterval(timer.interval);
                        timer.interval = null;
                    }
                    matchLastUpdateTime.set(matchId, Date.now());
                }
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
            logger.info(`listId: ${listId}, roomName: ${roomName}`);
            
            socket.join(roomName);
            
            logger.info(`통합 오버레이 방 조인 완료: ${roomName}`);
        } catch (error) {
            logger.error('join_unified_overlay 이벤트 처리 중 오류 발생:', error);
        }
    });



    // 타이머 상태 요청 이벤트 처리
    socket.on('request_timer_state', async (data) => {
        try {
            const { matchId } = data;
            logger.info(`타이머 상태 요청: matchId=${matchId}`);
            
            const match = await Match.findByPk(matchId);
            if (!match) {
                throw new Error('경기를 찾을 수 없습니다.');
            }
            
            const matchData = match.match_data || {};
            const timerState = {
                matchId: matchId,
                currentSeconds: matchData.currentSeconds || matchData.timer || 0,
                minute: matchData.minute || Math.floor((matchData.currentSeconds || matchData.timer || 0) / 60),
                second: matchData.second || ((matchData.currentSeconds || matchData.timer || 0) % 60),
                isRunning: matchData.isRunning || false,
                lastUpdateTime: Date.now()
            };
            
            // 요청한 클라이언트에게 타이머 상태 전송
            socket.emit('timer_state', timerState);
            logger.info(`타이머 상태 전송 완료:`, timerState);
        } catch (error) {
            logger.error('request_timer_state 이벤트 처리 중 오류 발생:', error);
            socket.emit('timer_state', { error: error.message });
        }
    });

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

    // 타이머 제어 이벤트
    socket.on('timer_control', async (data) => {
        const { matchId, action, minutes, seconds } = data;
        const roomName = `match_${matchId}`;
        
        // 타이머가 없으면 생성
        let timer = matchTimers.get(matchId);
        if (!timer) {
            timer = {
                interval: null,
                currentSeconds: 0,
                isRunning: false
            };
            matchTimers.set(matchId, timer);
        }
        
        switch (action) {
            case 'start':
                if (!timer.isRunning) {
                    timer.isRunning = true;
                    timer.interval = setInterval(() => {
                        timer.currentSeconds++;
                        matchLastUpdateTime.set(matchId, Date.now());
                        io.to(roomName).emit('timer_update', {
                            currentSeconds: timer.currentSeconds,
                            isRunning: true,
                            lastUpdateTime: Date.now()
                        });
                    }, 1000);
                }
                break;
                
            case 'stop':
                stopMatchTimer(matchId);
                io.to(roomName).emit('timer_update', {
                    currentSeconds: timer.currentSeconds,
                    isRunning: false,
                    lastUpdateTime: Date.now()
                });
                break;
                
            case 'reset':
                resetMatchTimer(matchId);
                io.to(roomName).emit('timer_update', {
                    currentSeconds: 0,
                    isRunning: false,
                    lastUpdateTime: Date.now()
                });
                break;
                
            case 'set':
                setMatchTimer(matchId, minutes, seconds);
                io.to(roomName).emit('timer_update', {
                    currentSeconds: timer.currentSeconds,
                    isRunning: timer.isRunning,
                    lastUpdateTime: Date.now()
                });
                break;
        }

        // 타이머 상태를 데이터베이스에 저장
        try {
            const match = await Match.findByPk(matchId);
            if (match) {
                const matchData = match.match_data || {};
                await match.update({
                    match_data: {
                        ...matchData,
                        timer: timer.currentSeconds,
                        lastUpdateTime: Date.now(),
                        isRunning: timer.isRunning
                    }
                });
            }
        } catch (error) {
            logger.error('타이머 상태 저장 중 오류 발생:', error);
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
server.listen(PORT, '0.0.0.0', async () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  
  // 기본 종목 초기화
  await initializeDefaultSports();
  
  // 기본 설정 초기화
  await initializeDefaultSettings();
  
  await restoreMatchTimers();
  await sequelize.sync({ alter: true });
  
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

// 템플릿 목록 조회 API
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await Template.findAll();
    res.json(templates.map(template => ({
      id: template.id,
      name: template.name,
      templateFile: template.file_name || `${template.name}-template.ejs`,
      controlFile: template.file_name ? template.file_name.replace('-template.ejs', '-control.ejs') : `${template.name}-control.ejs`,
      isDefault: template.is_default || false
    })));
  } catch (error) {
    logger.error('템플릿 목록 조회 중 오류:', error);
    res.status(500).json({ error: '템플릿 목록을 불러오는데 실패했습니다.' });
  }
});

// 템플릿 삭제 API
app.delete('/api/templates/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    // 데이터베이스에서 템플릿 찾기
    const template = await Template.findOne({ where: { name } });
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    // 기본 템플릿은 삭제 불가
    if (template.is_default) {
      return res.status(400).json({ error: '기본 템플릿은 삭제할 수 없습니다.' });
    }
    
    const viewsDir = path.join(__dirname, 'views');
    const templateFile = path.join(viewsDir, `${name}-template.ejs`);
    const controlFile = path.join(viewsDir, `${name}-control.ejs`);
    
    // 파일이 존재하는지 확인
    if (!fsSync.existsSync(templateFile) || !fsSync.existsSync(controlFile)) {
      return res.status(404).json({ error: '템플릿 파일을 찾을 수 없습니다.' });
    }
    
    // 파일 삭제
    fsSync.unlinkSync(templateFile);
    fsSync.unlinkSync(controlFile);
    
    // 데이터베이스에서 템플릿 삭제
    await template.destroy();
    
    res.json({ success: true });
  } catch (error) {
    logger.error('템플릿 삭제 중 오류:', error);
    res.status(500).json({ error: '템플릿 삭제에 실패했습니다.' });
  }
});

// 종목 템플릿 업데이트 API
app.put('/api/sport/:id', async (req, res) => {
  try {
    const sport = await Sport.findByPk(req.params.id);
    if (!sport) {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    // 기본 종목은 템플릿 변경 불가
    if (sport.is_default) {
      return res.status(400).json({ error: '기본 종목의 템플릿은 변경할 수 없습니다.' });
    }

    const { template } = req.body;
    if (!template) {
      return res.status(400).json({ error: '템플릿은 필수입니다.' });
    }

    // 템플릿이 존재하는지 확인
    const existingTemplate = await Template.findOne({ where: { name: template } });
    if (!existingTemplate) {
      return res.status(400).json({ error: '존재하지 않는 템플릿입니다.' });
    }

    await sport.update({ template });
    logger.info(`종목 템플릿 업데이트: ${sport.id} -> ${template}`);
    res.json(sport);
  } catch (error) {
    logger.error('종목 템플릿 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 목록 조회 API
app.get('/api/matches', async (req, res) => {
  try {
    console.log('경기 목록 조회 요청 받음');
    
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });
    
    console.log(`조회된 경기 수: ${matches.length}`);

    const matchesWithUrls = matches.map(match => {
      const matchData = match.toJSON();

      return {
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
    
    // 해당 스포츠의 컨트롤 템플릿 렌더링
    res.render(`${req.params.sport}-control`, { 
      match: {
        ...match.toJSON(),
        home_score: homeScore,
        away_score: awayScore
      },
      defaultColors
    });
  } catch (error) {
    logger.error('컨트롤 패널 로드 실패:', error);
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
      away_team_color: match.away_team_color
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
    const { team, teamName } = req.body;
    
    if (!team || !teamName) {
      return res.status(400).json({ success: false, error: '팀 정보와 팀명이 필요합니다.' });
    }
    
    const match = await Match.findByPk(id);
    if (!match) {
      return res.status(404).json({ success: false, error: '경기를 찾을 수 없습니다.' });
    }
    
    // 팀명 업데이트
    if (team === 'home') {
      match.home_team = teamName;
    } else if (team === 'away') {
      match.away_team = teamName;
    } else {
      return res.status(400).json({ success: false, error: '잘못된 팀 정보입니다.' });
    }
    
    await match.save();
    
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

// 자동 로그 관리 상태 확인 API
app.get('/api/logs/auto-management-status', (req, res) => {
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
        
        oldestBackup = new Date(Math.min(...backupDates));
        newestBackup = new Date(Math.max(...backupDates));
      }
    }
    
    // 현재 로그 파일들의 크기 계산
    const files = fsSync.readdirSync(logDir);
    let currentLogSize = 0;
    let logFileCount = 0;
    
    files.forEach(file => {
      if (file.endsWith('.log') && !file.includes('backup')) {
        const filePath = path.join(logDir, file);
        const stats = fsSync.statSync(filePath);
        currentLogSize += stats.size;
        logFileCount++;
      }
    });
    
    res.json({
      success: true,
      data: {
        config: {
          autoBackupInterval: LOG_MANAGEMENT_CONFIG.AUTO_BACKUP_INTERVAL,
          maxLogSizeMB: LOG_MANAGEMENT_CONFIG.MAX_LOG_SIZE_MB,
          maxTotalLogSizeMB: LOG_MANAGEMENT_CONFIG.MAX_TOTAL_LOG_SIZE_MB,
          backupRetentionDays: LOG_MANAGEMENT_CONFIG.BACKUP_RETENTION_DAYS
        },
        current: {
          logFileCount,
          currentLogSizeMB: (currentLogSize / (1024 * 1024)).toFixed(2),
          backupCount,
          totalBackupSizeMB: (totalBackupSize / (1024 * 1024)).toFixed(2),
          oldestBackup: oldestBackup ? oldestBackup.toISOString() : null,
          newestBackup: newestBackup ? newestBackup.toISOString() : null
        }
      }
    });
  } catch (error) {
    logger.error('자동 로그 관리 상태 확인 실패:', error);
    res.status(500).json({ error: '자동 로그 관리 상태 확인 실패' });
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
    
    // 첫 번째 경기를 기본으로 사용 (푸시 시 변경됨)
    const currentMatch = list.matches[0];
    console.log(`[DEBUG] 기본 경기 정보:`, currentMatch);
    
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
      currentMatchIndex: 0,
      totalMatches: list.matches.length,
      isListMode: true
    });
  } catch (error) {
    console.error('[DEBUG] 통합 오버레이 로드 실패:', error);
    logger.error('통합 오버레이 로드 실패:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
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
app.get('/match-list-manager', (req, res) => {
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

// 모든 경기 데이터 삭제 API
app.delete('/api/matches/all', async (req, res) => {
  try {
    logger.info('=== 모든 경기 데이터 삭제 시작 ===');
    
    // 모든 경기 삭제
    const deletedMatches = await Match.destroy({
      where: {},
      truncate: false
    });
    
    // 모든 리스트 삭제
    const deletedLists = await MatchList.destroy({
      where: {},
      truncate: false
    });
    
    // 푸시된 경기 정보 초기화
    pushedMatches.clear();
    
    logger.info(`모든 경기 데이터 삭제 완료: 경기 ${deletedMatches}개, 리스트 ${deletedLists}개 삭제됨`);
    
    res.json({
      success: true,
      message: `모든 경기 데이터가 삭제되었습니다. (경기 ${deletedMatches}개, 리스트 ${deletedLists}개)`,
      deletedMatches,
      deletedLists
    });
  } catch (error) {
    logger.error('모든 경기 데이터 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 삭제 API
app.delete('/api/match/:id', async (req, res) => {
    try {
        const match = await Match.findByPk(req.params.id);
        if (!match) {
            return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
        }

        await match.destroy();
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

// 경기 리스트 API - 리스트 조회
app.get('/api/match-lists', async (req, res) => {
  try {
    const lists = await MatchList.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(lists);
  } catch (error) {
    logger.error('리스트 조회 실패:', error);
    res.status(500).json({ error: '리스트 조회에 실패했습니다.' });
  }
});

// 경기 리스트 API - 리스트 생성
app.post('/api/match-lists', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '리스트 이름이 필요합니다.' });
    }
    
    const list = await MatchList.create({
      name: name.trim(),
      matches: [],
      created_by: req.ip || 'unknown'
    });
    
    res.json(list);
  } catch (error) {
    logger.error('리스트 생성 실패:', error);
    res.status(500).json({ error: '리스트 생성에 실패했습니다.' });
  }
});

// 경기 리스트 API - 리스트 수정
app.put('/api/match-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, matches } = req.body;
    
    const list = await MatchList.findByPk(id);
    if (!list) {
      return res.status(404).json({ error: '리스트를 찾을 수 없습니다.' });
    }
    
    if (name !== undefined) {
      list.name = name.trim();
    }
    if (matches !== undefined) {
      list.matches = matches;
    }
    
    await list.save();
    res.json(list);
  } catch (error) {
    logger.error('리스트 수정 실패:', error);
    res.status(500).json({ error: '리스트 수정에 실패했습니다.' });
  }
});

// 경기 리스트 API - 리스트 삭제
app.delete('/api/match-lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await MatchList.findByPk(id);
    if (!list) {
      return res.status(404).json({ error: '리스트를 찾을 수 없습니다.' });
    }
    
    await list.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error('리스트 삭제 실패:', error);
    res.status(500).json({ error: '리스트 삭제에 실패했습니다.' });
  }
});



// 경기 리스트별 모바일 컨트롤 페이지
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
