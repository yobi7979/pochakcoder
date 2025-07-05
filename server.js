const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const { sequelize, Match } = require('./models');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const Sport = require('./models/Sport');
const Template = require('./models/Template');
const { Op } = require('sequelize');
const session = require('express-session');
const ejs = require('ejs');

// 로깅 설정
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console()
  ]
});

const app = express();
const server = http.createServer(app);
// Socket.IO 설정 - Railway 도메인 허용
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://sportscoder-production.up.railway.app',
      'https://*.up.railway.app'
    ],
    credentials: true
  }
});

// 팀 로고 업로드를 위한 multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'public/TEAMLOGO/BASEBALL');
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // 원본 파일명을 안전하게 처리
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // 같은 이름의 파일이 있는지 확인하고 있으면 삭제
    const filePath = path.join(__dirname, 'public/TEAMLOGO/BASEBALL', originalName);
    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
      logger.info(`기존 로고 파일 삭제: ${filePath}`);
    }
    
    cb(null, originalName);
  }
});

// 이미지 업로드를 위한 multer 설정
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 // 1MB 제한
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('지원하지 않는 파일 형식입니다.');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    cb(null, true);
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

// EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS 템플릿에 함수 전달
app.locals.hexToRgb = hexToRgb;

// 미들웨어 설정
// CORS 설정 - Railway 도메인 허용
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://sportscoder-production.up.railway.app',
    'https://*.up.railway.app'
  ],
  credentials: true
}));
app.use(bodyParser.json());
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
    if (matchTimers.has(matchId)) return;
    
    const timer = {
        interval: null,
        currentSeconds: 0,
        isRunning: false
    };
    
    matchTimers.set(matchId, timer);
    matchLastUpdateTime.set(matchId, Date.now());
}

function stopMatchTimer(matchId) {
    const timer = matchTimers.get(matchId);
    if (timer && timer.interval) {
        clearInterval(timer.interval);
        timer.interval = null;
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
    const timer = matchTimers.get(matchId);
    if (timer) {
        timer.currentSeconds = minutes * 60 + seconds;
        matchLastUpdateTime.set(matchId, Date.now());
    }
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
            
            // 타이머 초기화
            startMatchTimer(match.id);
            const timer = matchTimers.get(match.id);
            
            if (timer) {
                // 저장된 타이머 값이 있으면 사용, 없으면 0으로 설정
                timer.currentSeconds = matchData.timer || 0;
                
                // 타이머가 실행 중이었다면 경과 시간 추가
                if (matchData.isRunning) {
                    timer.currentSeconds += timeDiff;
                    timer.isRunning = true;
                    
                    // 타이머 자동 재시작
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

    // 모든 종목에 대해 컨트롤러와 오버레이 URL 생성
    const overlay_url = `/${sport_type.toLowerCase()}/${match.id}/overlay`;
    const control_url = `/${sport_type.toLowerCase()}/${match.id}/control`;

    res.status(201).json({
      ...match.toJSON(),
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

// 팀 로고 매핑 JSON 업데이트 API
app.post('/api/update-team-logo-map', async (req, res) => {
  try {
    // 로고 매핑 데이터 확인
    const logoMapData = req.body;
    if (!logoMapData) {
      return res.status(400).json({ error: '로고 매핑 데이터가 제공되지 않았습니다.' });
    }

    // 디렉토리 생성 (없는 경우)
    const logoDir = path.join(__dirname, 'public/TEAMLOGO/BASEBALL');
    if (!fsSync.existsSync(logoDir)) {
      fsSync.mkdirSync(logoDir, { recursive: true });
    }

    // JSON 파일 저장
    const logoMapPath = path.join(logoDir, 'team_logo_map.json');
    await fs.writeFile(logoMapPath, JSON.stringify(logoMapData, null, 2), 'utf8');

    logger.info('팀 로고 매핑 데이터가 업데이트되었습니다.');
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
    logger.info(`클라이언트 ID: ${socket.id}`);

    // 특정 경기방 참여
    socket.on('join', (matchId) => {
        const roomName = `match_${matchId}`;
        socket.join(roomName);
        
        // 타이머가 없으면 생성
        if (!matchTimers.has(matchId)) {
            startMatchTimer(matchId);
        }
        
        // 현재 타이머 상태 전송
        const timer = matchTimers.get(matchId);
        socket.emit('timer_state', {
            currentSeconds: timer.currentSeconds,
            isRunning: timer.isRunning
        });
        
        logger.info(`클라이언트 ${socket.id}가 경기방 ${roomName}에 참여함`);
        socket.emit('joined', roomName);
    });

    // 타이머 제어 이벤트
    socket.on('timer_control', async (data) => {
        const { matchId, action, minutes, seconds } = data;
        const roomName = `match_${matchId}`;
        const timer = matchTimers.get(matchId);
        
        if (!timer) return;
        
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

    // 클라이언트에서 직접 보내는 match_update 이벤트 처리
    socket.on('match_update', async (data) => {
        const { matchId, data: matchData } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 match_update 이벤트 수신: ${JSON.stringify(matchData)}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('match_update_response', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 스포츠 타입에 따른 데이터 업데이트
            let updateData = {
                home_score: matchData.home_score,
                away_score: matchData.away_score
            };

            if (match.sport_type === 'soccer') {
                // 축구 경기 데이터 업데이트
                updateData.match_data = {
                    ...match.match_data,
                    state: matchData.match_data.state,
                    home_shots: matchData.match_data.home_shots,
                    away_shots: matchData.match_data.away_shots,
                    home_shots_on_target: matchData.match_data.home_shots_on_target,
                    away_shots_on_target: matchData.match_data.away_shots_on_target,
                    home_corners: matchData.match_data.home_corners,
                    away_corners: matchData.match_data.away_corners,
                    home_fouls: matchData.match_data.home_fouls,
                    away_fouls: matchData.match_data.away_fouls
                };
            } else if (match.sport_type === 'baseball') {
                // 야구 경기 데이터 업데이트
                updateData.match_data = {
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
                };
            }

            // 데이터 업데이트
            await match.update(updateData);
            
            // 해당 방의 모든 클라이언트에게 업데이트 전송
            io.to(roomName).emit('match_update', {
                id: matchId,
                home_score: updateData.home_score,
                away_score: updateData.away_score,
                match_data: updateData.match_data
            });
            
            // 성공 응답 전송
            socket.emit('match_update_response', { success: true });
            
            logger.info(`match_update 이벤트를 방 ${roomName}에 전송함`);
        } catch (error) {
            logger.error('match_update 이벤트 처리 중 오류 발생:', error);
            socket.emit('match_update_response', { success: false, error: error.message });
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
        const { matchId, teamType, teamName } = data;
        const roomName = `match_${matchId}`;
        
        logger.info(`클라이언트 ${socket.id}에서 팀 이름 업데이트 요청: ${JSON.stringify(data)}`);
        
        try {
            const match = await Match.findByPk(matchId);
            if (!match) {
                socket.emit('teamNameUpdated', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }
            
            // 팀 이름 업데이트
            const updateField = teamType === 'home' ? 'home_team' : 'away_team';
            await match.update({ [updateField]: teamName });
            
            // 모든 클라이언트에게 팀 이름 업데이트 알림
            io.to(roomName).emit('teamNameUpdate', {
                matchId: matchId,
                teamType: teamType,
                teamName: teamName
            });
            
            // 성공 응답 전송
            socket.emit('teamNameUpdated', { success: true });
            
            logger.info(`팀 이름 업데이트 성공: ${teamType}팀, 이름: ${teamName}`);
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
                id: matchId,
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
    socket.on('updateTeamLogo', async (data) => {
        try {
            const { matchId, team, logoPath, logoBgColor, teamId } = data;
            const match = await Match.findByPk(matchId);
            
            if (!match) {
                socket.emit('error', { message: '경기를 찾을 수 없습니다.' });
                return;
            }

            // 기존 match_data 객체 복사
            const matchData = { ...match.match_data } || {};
            
            // 해당 팀의 로고 경로 및 배경색 업데이트
            matchData[`${team}_team_logo`] = logoPath;
            matchData[`${team}_team_colorbg`] = logoBgColor;
            
            // 데이터베이스 업데이트
            await match.update({ match_data: matchData });
            
            // 팀별 로고 매핑 정보 업데이트
            try {
                // 로고 파일 이름 추출 (경로에서 파일명만 추출)
                const logoFileName = decodeURIComponent(path.basename(logoPath));
                // 팀명 가져오기
                const teamName = team === 'home' ? match.home_team : match.away_team;
                // 팀ID가 없으면 매치ID와 팀 타입으로 구성
                const actualTeamId = teamId || `${matchId}_${team}`;
                
                // 팀 로고 매핑 파일 경로
                const logoDir = path.join(__dirname, 'public/TEAMLOGO/BASEBALL');
                const teamLogoMapPath = path.join(logoDir, 'team_logo_map.json');
                
                // 기존 매핑 정보 읽기
                let teamLogoMap = {};
                if (fsSync.existsSync(teamLogoMapPath)) {
                    teamLogoMap = JSON.parse(fsSync.readFileSync(teamLogoMapPath, 'utf8'));
                }
                
                // 새 매핑 정보 추가 (팀ID 기반)
                if (!teamLogoMap.teams) {
                    teamLogoMap.teams = {};
                }
                
                if (!teamLogoMap.teams[actualTeamId]) {
                    teamLogoMap.teams[actualTeamId] = {
                        name: teamName,
                        logo: logoFileName,
                        lastUpdated: new Date().toISOString()
                    };
                } else {
                    teamLogoMap.teams[actualTeamId].logo = logoFileName;
                    teamLogoMap.teams[actualTeamId].lastUpdated = new Date().toISOString();
                }
                
                // 파일로 저장
                fsSync.writeFileSync(teamLogoMapPath, JSON.stringify(teamLogoMap, null, 2), 'utf8');
                
                logger.info(`팀 로고 매핑 정보 업데이트: 팀ID ${actualTeamId} => ${logoFileName}`);
            } catch (mapError) {
                logger.error('팀 로고 매핑 정보 업데이트 오류:', mapError);
            }
            
            // 모든 클라이언트에게 업데이트 알림
            io.emit('teamLogoUpdated', {
                matchId,
                team,
                logoPath,
                teamId: teamId || `${matchId}_${team}`,
                success: true,
                logoBgColor: logoBgColor
            });
        } catch (error) {
            console.error('팀 로고 업데이트 오류:', error);
            socket.emit('error', { message: '서버 오류가 발생했습니다.' });
        }
    });

    // 팀 로고 삭제 소켓 이벤트
    socket.on('removeTeamLogo', async (data) => {
        try {
            const { matchId, team } = data;
            const match = await Match.findByPk(matchId);
            
            if (!match) {
                socket.emit('teamLogoRemoved', { success: false, error: '경기를 찾을 수 없습니다.' });
                return;
            }

            const matchData = { ...match.match_data } || {};
            // 로고 경로 정보 백업
            const logoPath = matchData[`${team}_team_logo`];
            // 로고 정보와 배경색 정보 삭제
            matchData[`${team}_team_logo`] = null;
            matchData[`${team}_team_colorbg`] = null;
            
            await match.update({ match_data: matchData });
            
            // 팀별 로고 매핑 정보에서 삭제
            try {
                // 팀명 가져오기
                const teamName = team === 'home' ? match.home_team : match.away_team;
                
                // 팀 로고 매핑 파일 경로
                const logoDir = path.join(__dirname, 'public/TEAMLOGO/BASEBALL');
                const teamLogoMapPath = path.join(logoDir, 'team_logo_map.json');
                
                // 기존 매핑 정보 읽기
                if (fsSync.existsSync(teamLogoMapPath)) {
                    let teamLogoMap = JSON.parse(fsSync.readFileSync(teamLogoMapPath, 'utf8'));
                    
                    // 팀 로고 매핑 삭제
                    if (teamLogoMap[teamName]) {
                        delete teamLogoMap[teamName];
                        
                        // 파일로 저장
                        fsSync.writeFileSync(teamLogoMapPath, JSON.stringify(teamLogoMap, null, 2), 'utf8');
                        
                        logger.info(`팀 로고 매핑 정보 삭제: ${teamName}`);
                    }
                }
            } catch (mapError) {
                logger.error('팀 로고 매핑 정보 삭제 오류:', mapError);
            }
            
            // 모든 클라이언트에게 업데이트 알림
            io.emit('teamLogoRemoved', {
                matchId,
                team,
                success: true
            });
        } catch (error) {
            console.error('팀 로고 삭제 오류:', error);
            socket.emit('teamLogoRemoved', { success: false, error: '서버 오류가 발생했습니다.' });
        }
    });

    // 연결 해제
    socket.on('disconnect', () => {
        logger.info(`클라이언트 ${socket.id} 연결 해제됨`);
    });
});

// 경기 데이터 업데이트 API
app.post('/api/match/:id', async (req, res) => {
    try {
        const match = await Match.findByPk(req.params.id);
        if (!match) {
            return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
        }

        // 스포츠 타입에 따른 데이터 업데이트
        let updateData = {
            home_score: req.body.home_score,
            away_score: req.body.away_score
        };

        if (match.sport_type === 'soccer') {
            // 축구 경기 데이터 업데이트
            updateData.match_data = {
                ...match.match_data,
                state: req.body.match_data.state,
                home_shots: req.body.match_data.home_shots,
                away_shots: req.body.match_data.away_shots,
                home_shots_on_target: req.body.match_data.home_shots_on_target,
                away_shots_on_target: req.body.match_data.away_shots_on_target,
                home_corners: req.body.match_data.home_corners,
                away_corners: req.body.match_data.away_corners,
                home_fouls: req.body.match_data.home_fouls,
                away_fouls: req.body.match_data.away_fouls
            };
        } else if (match.sport_type === 'baseball') {
            // 야구 경기 데이터 업데이트
            updateData.match_data = {
                ...match.match_data,
                current_inning: req.body.match_data.current_inning,
                inning_type: req.body.match_data.inning_type,
                first_base: req.body.match_data.first_base,
                second_base: req.body.match_data.second_base,
                third_base: req.body.match_data.third_base,
                balls: req.body.match_data.balls,
                strikes: req.body.match_data.strikes,
                outs: req.body.match_data.outs,
                batter_name: req.body.match_data.batter_name,
                batter_number: req.body.match_data.batter_number,
                batter_position: req.body.match_data.batter_position,
                batter_avg: req.body.match_data.batter_avg,
                pitcher_name: req.body.match_data.pitcher_name,
                pitcher_number: req.body.match_data.pitcher_number,
                pitcher_position: req.body.match_data.pitcher_position,
                pitcher_era: req.body.match_data.pitcher_era,
                home_hits: req.body.match_data.home_hits,
                away_hits: req.body.match_data.away_hits,
                home_errors: req.body.match_data.home_errors,
                away_errors: req.body.match_data.away_errors,
                innings: req.body.match_data.innings
            };
        }

        // 데이터 업데이트
        await match.update(updateData);
        
        // Socket.IO를 통해 실시간 업데이트 전송
        const roomName = `match_${match.id}`;
        const eventData = {
            id: match.id,
            home_score: updateData.home_score,
            away_score: updateData.away_score,
            match_data: updateData.match_data
        };
        
        logger.info(`Socket.IO 이벤트 전송: match_update, 방: ${roomName}`);
        logger.info(`전송 데이터: ${JSON.stringify(eventData)}`);
        
        io.to(roomName).emit('match_update', eventData);

        // 업데이트된 데이터 반환
        const updatedMatch = await Match.findByPk(match.id);
        res.json(updatedMatch);
    } catch (error) {
        logger.error('경기 데이터 업데이트 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 경기 삭제 API
app.delete('/api/match/:id', async (req, res) => {
    try {
        const matchId = req.params.id;
        logger.info(`경기 삭제 요청: ID=${matchId}`);
        
        const match = await Match.findByPk(matchId);
        if (!match) {
            logger.warn(`경기 삭제 실패: ID=${matchId} - 경기를 찾을 수 없습니다.`);
            return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
        }

        // 경기 삭제
        await match.destroy();
        
        logger.info(`경기 삭제 성공: ID=${matchId}`);
        res.status(200).json({ message: '경기가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        logger.error(`경기 삭제 오류: ID=${req.params.id}`, error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error.message });
    }
});

// 모든 경기 데이터 삭제 API
app.delete('/api/matches/all', async (req, res) => {
    try {
        logger.info('모든 경기 데이터 삭제 요청');
        
        // 모든 경기 데이터 삭제
        const deletedCount = await Match.destroy({
            where: {},
            truncate: true
        });
        
        logger.info(`모든 경기 데이터 삭제 성공: ${deletedCount}개 경기 삭제됨`);
        res.status(200).json({ 
            message: '모든 경기 데이터가 성공적으로 삭제되었습니다.',
            deletedCount: deletedCount
        });
    } catch (error) {
        logger.error('모든 경기 데이터 삭제 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error.message });
    }
});

// 야구 컨트롤 패널
app.get('/baseball/:id/control', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    res.render('baseball-control', { match });
  } catch (error) {
    logger.error('야구 컨트롤 패널 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 야구 오버레이
app.get('/baseball/:id/overlay', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    res.render('baseball-template', { match });
  } catch (error) {
    logger.error('야구 오버레이 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 축구 컨트롤 패널
app.get('/soccer/:id/control', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    res.render('soccer-control', { match });
  } catch (error) {
    logger.error('축구 컨트롤 패널 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 축구 오버레이
app.get('/soccer/:id/overlay', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    res.render('soccer-template', { match });
  } catch (error) {
    logger.error('축구 오버레이 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// EJS 편집기 페이지
app.get('/ejs-editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'ejs-editor.html'));
});

// 선수 명단 CSV 처리 API
app.post('/api/upload-player-data', csvUpload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'CSV 파일이 없습니다.' });
        }

        const csvData = req.file.buffer.toString('utf8');
        const matchId = req.body.matchId;
        
        if (!matchId) {
            return res.status(400).json({ error: '매치 ID가 제공되지 않았습니다.' });
        }

        // CSV 데이터를 JSON으로 변환
        const lines = csvData.trim().split('\n');
        
        // 구분자 자동 감지 (탭 또는 쉼표)
        let delimiter = '\t';
        if (lines[0].includes(',') && !lines[0].includes('\t')) {
            delimiter = ',';
        }
        
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const players = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(delimiter).map(v => v.trim());
            const player = {};
            
            headers.forEach((header, index) => {
                player[header] = values[index] || '';
            });
            
            players.push(player);
        }
        
        // JSON 파일로 저장
        const playerDataDir = path.join(__dirname, 'public/PLAYERDATA');
        if (!fsSync.existsSync(playerDataDir)) {
            fsSync.mkdirSync(playerDataDir, { recursive: true });
        }
        
        const playerDataPath = path.join(playerDataDir, `players_${matchId}_home.json`);
        await fs.writeFile(playerDataPath, JSON.stringify({
            matchId: matchId,
            updatedAt: new Date().toISOString(),
            players: players
        }, null, 2), 'utf8');
        
        logger.info(`선수 데이터가 JSON으로 저장됨: ${playerDataPath}`);

        // 소켓으로 CSV 데이터 전송
        io.to(matchId).emit('playerDataUpdated', {
            matchId,
            csvData,
            playerDataUrl: `/PLAYERDATA/players_${matchId}_home.json`
        });

        res.json({
            success: true,
            message: '선수 데이터가 성공적으로 업로드되었습니다.',
            playerDataUrl: `/PLAYERDATA/players_${matchId}_home.json`
        });
    } catch (error) {
        console.error('선수 데이터 업로드 중 오류 발생:', error);
        res.status(500).json({
            error: '선수 데이터 처리 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 현재 타자/투수 변경 API
app.post('/api/update-current-players', (req, res) => {
    try {
        const { matchId, batterIndex, pitcherIndex, teamType } = req.body;
        
        if (!matchId) {
            return res.status(400).json({ error: '매치 ID가 제공되지 않았습니다.' });
        }
        
        if (!teamType || (teamType !== 'home' && teamType !== 'away')) {
            return res.status(400).json({ error: '유효한 팀 타입(home 또는 away)을 지정해야 합니다.' });
        }

        // 소켓으로 현재 타자/투수 정보 전송
        io.to(`match_${matchId}`).emit('currentPlayerChanged', {
            matchId,
            batterIndex,
            pitcherIndex,
            teamType // 팀 타입 추가
        });

        res.json({
            success: true,
            message: `${teamType === 'home' ? '홈팀' : '어웨이팀'} 현재 타자/투수 정보가 업데이트되었습니다.`
        });
    } catch (error) {
        console.error('현재 타자/투수 업데이트 중 오류 발생:', error);
        res.status(500).json({
            error: '현재 타자/투수 업데이트 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 선수 데이터 JSON 가져오기 API
app.get('/api/player-data/:matchId', async (req, res) => {
    try {
        const matchId = req.params.matchId;
        const playerDataPath = path.join(__dirname, 'public/PLAYERDATA', `players_${matchId}_home.json`);
        
        if (!fsSync.existsSync(playerDataPath)) {
            return res.status(404).json({ 
                success: false, 
                error: '해당 경기의 선수 데이터가 없습니다.' 
            });
        }
        
        const data = await fs.readFile(playerDataPath, 'utf8');
        const playerData = JSON.parse(data);
        
        res.json({
            success: true,
            data: playerData
        });
    } catch (error) {
        logger.error('선수 데이터 조회 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '선수 데이터 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// CSV 파일 업로드 및 JSON 변환 엔드포인트
app.post('/api/upload-player-csv', csvUpload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }
    
    // 팀 타입 확인 (home 또는 away)
    const teamType = req.body.teamType;
    if (!teamType || (teamType !== 'home' && teamType !== 'away')) {
      return res.status(400).json({ error: '유효한 팀 타입(home 또는 away)을 지정해야 합니다.' });
    }
    
    // 해당 매치 ID (선택 사항)
    const matchId = req.body.matchId || 'common';
    
    // 플레이어 데이터 디렉토리 생성
    const playerDataDir = path.join(__dirname, 'public', 'PLAYERDATA');
    if (!fsSync.existsSync(playerDataDir)) {
      fsSync.mkdirSync(playerDataDir, { recursive: true });
    }
    
    // CSV 파일 읽기 (메모리에서 직접 읽기)
    const fileContent = req.file.buffer.toString('utf8');
    const lines = fileContent.split('\n');
    
    // 구분자 자동 감지 (탭 또는 쉼표)
    let delimiter = ',';
    if (lines[0].includes('\t') && !lines[0].includes(',')) {
        delimiter = '\t';
    }
    
    const headers = lines[0].split(delimiter);
    
    // 결과 배열 초기화
    const players = [];
    
    // 각 라인 처리하여 JSON 객체로 변환
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(delimiter);
      const player = {};
      
      for (let j = 0; j < headers.length; j++) {
        // 헤더와 값을 매핑
        const header = headers[j].trim();
        const value = values[j] ? values[j].trim() : '';
        player[header] = value;
      }
      
      // 타율과 출루율 계산
      if (player['타수'] && player['안타']) {
        const atBats = parseInt(player['타수']);
        const hits = parseInt(player['안타']);
        if (atBats > 0) {
          player['타율'] = (hits / atBats).toFixed(3);
        } else {
          player['타율'] = '0.000';
        }
      }
      
      // 출루율 계산 (안타 + 볼넷 + 사구) / (타수 + 볼넷 + 사구 + 희생플라이)
      if (player['타수'] && player['안타'] && player['볼넷'] !== undefined && player['사구'] !== undefined && player['희플'] !== undefined) {
        const atBats = parseInt(player['타수']);
        const hits = parseInt(player['안타']);
        const walks = parseInt(player['볼넷']) || 0;
        const hitByPitch = parseInt(player['사구']) || 0;
        const sacrificeFly = parseInt(player['희플']) || 0;
        
        const numerator = hits + walks + hitByPitch;
        const denominator = atBats + walks + hitByPitch + sacrificeFly;
        
        if (denominator > 0) {
          player['출루율'] = (numerator / denominator).toFixed(3);
        } else {
          player['출루율'] = '0.000';
        }
      }
      
      players.push(player);
    }
    
    // 결과 JSON 구조
    const result = {
      teamType: teamType,
      matchId: matchId,
      players: players,
      lastUpdated: new Date().toISOString()
    };
    
    // JSON 파일로 저장 (팀 타입과 매치 ID로 구분)
    const jsonFileName = `players_${matchId}_${teamType}.json`;
    const jsonFilePath = path.join(playerDataDir, jsonFileName);
    fsSync.writeFileSync(jsonFilePath, JSON.stringify(result, null, 2), 'utf8');
    
    // 성공 응답
    res.json({
      success: true,
      message: `${teamType === 'home' ? '홈팀' : '어웨이팀'} 플레이어 데이터가 성공적으로 업로드되었습니다.`,
      filePath: `/PLAYERDATA/${jsonFileName}`,
      count: players.length
    });
    
    // 소켓 이벤트 발송
    if (matchId && matchId !== 'common') {
      io.to(`match_${matchId}`).emit('playerDataUpdated', {
        matchId: matchId,
        teamType: teamType,
        playerDataUrl: `/PLAYERDATA/${jsonFileName}`,
        count: players.length
      });
    }
  } catch (error) {
    console.error('CSV 업로드 에러:', error);
    res.status(500).json({ error: '플레이어 데이터 처리 중 오류가 발생했습니다.' });
  }
});

// 팀별 JSON 플레이어 데이터 제공 API
app.get('/api/player-data/:matchId/:teamType', (req, res) => {
  try {
    const matchId = req.params.matchId;
    const teamType = req.params.teamType;
    
    if (!teamType || (teamType !== 'home' && teamType !== 'away')) {
      return res.status(400).json({ error: '유효한 팀 타입(home 또는 away)을 지정해야 합니다.' });
    }
    
    const jsonFileName = `players_${matchId}_${teamType}.json`;
    const playerDataPath = path.join(__dirname, 'public', 'PLAYERDATA', jsonFileName);
    
    if (!fsSync.existsSync(playerDataPath)) {
      return res.status(404).json({ error: `${teamType === 'home' ? '홈팀' : '어웨이팀'} 플레이어 데이터가 존재하지 않습니다.` });
    }
    
    const playerData = fsSync.readFileSync(playerDataPath, 'utf8');
    res.json(JSON.parse(playerData));
  } catch (error) {
    console.error('플레이어 데이터 조회 에러:', error);
    res.status(500).json({ error: '플레이어 데이터 조회 중 오류가 발생했습니다.' });
  }
});

// 라인업 저장 API
app.post('/api/save-lineup', async (req, res) => {
    const { matchId, lineup } = req.body;
    
    if (!matchId || !lineup) {
        return res.status(400).json({ error: '필수 데이터가 누락되었습니다.' });
    }
    
    try {
        // 선수 데이터 파일 경로
        const basePlayerPath = path.join(__dirname, 'public', 'PLAYERDATA');
        const matchPlayerPath = path.join(basePlayerPath, `players_${matchId}_home.json`);
        const homePlayerPath = path.join(basePlayerPath, `players_${matchId}_home.json`);
        const awayPlayerPath = path.join(basePlayerPath, `players_${matchId}_away.json`);
        
        // 모든 선수 데이터를 수집
        let allPlayers = [];

        // 기존 단일 파일 확인
        if (fsSync.existsSync(matchPlayerPath)) {
            try {
                const playerData = JSON.parse(fsSync.readFileSync(matchPlayerPath, 'utf8'));
                if (playerData.players && Array.isArray(playerData.players)) {
                    allPlayers = playerData.players;
                }
            } catch (readErr) {
                logger.error(`선수 데이터 파일 읽기 오류: ${readErr.message}`);
            }
        } 
        // 홈/어웨이 파일 확인
        else if (fsSync.existsSync(homePlayerPath) || fsSync.existsSync(awayPlayerPath)) {
            // 홈팀 선수 데이터 추가
            if (fsSync.existsSync(homePlayerPath)) {
                try {
                    const homeData = JSON.parse(fsSync.readFileSync(homePlayerPath, 'utf8'));
                    if (homeData.players && Array.isArray(homeData.players)) {
                        allPlayers.push(...homeData.players);
                    }
                } catch (homeErr) {
                    logger.error(`홈팀 선수 데이터 읽기 오류: ${homeErr.message}`);
                }
            }
            
            // 어웨이팀 선수 데이터 추가
            if (fsSync.existsSync(awayPlayerPath)) {
                try {
                    const awayData = JSON.parse(fsSync.readFileSync(awayPlayerPath, 'utf8'));
                    if (awayData.players && Array.isArray(awayData.players)) {
                        allPlayers.push(...awayData.players);
                    }
                } catch (awayErr) {
                    logger.error(`어웨이팀 선수 데이터 읽기 오류: ${awayErr.message}`);
                }
            }
            
            // 선수 데이터가 발견되지 않은 경우
            if (allPlayers.length === 0) {
                return res.status(404).json({ error: '선수 데이터가 존재하지 않습니다.' });
            }
            
            // 통합 선수 데이터 파일 생성
            try {
                const mergedData = {
                    matchId: matchId,
                    updatedAt: new Date().toISOString(),
                    players: allPlayers
                };
                
                // 디렉토리가 없으면 생성
                if (!fsSync.existsSync(basePlayerPath)) {
                    fsSync.mkdirSync(basePlayerPath, { recursive: true });
                }
                
                fsSync.writeFileSync(matchPlayerPath, JSON.stringify(mergedData, null, 2), 'utf8');
                logger.info(`통합 선수 데이터 파일 생성 완료: ${matchPlayerPath}`);
            } catch (writeErr) {
                logger.error(`통합 선수 데이터 파일 생성 오류: ${writeErr.message}`);
            }
        } else {
            return res.status(404).json({ error: '선수 데이터가 존재하지 않습니다.' });
        }
        
        // 등록된 선수 번호 추출
        const registeredNumbers = new Set();
        if (lineup.home && lineup.home.players) {
            lineup.home.players.forEach(player => registeredNumbers.add(player.number));
        }
        if (lineup.away && lineup.away.players) {
            lineup.away.players.forEach(player => registeredNumbers.add(player.number));
        }
        
        // 등록되지 않은 선수 필터링
        const unregisteredPlayers = allPlayers.filter(player => 
            player.number && !registeredNumbers.has(player.number)
        );
        
        // 라인업 데이터에 등록되지 않은 선수 정보 추가
        const lineupData = {
            ...lineup,
            unregisteredPlayers: unregisteredPlayers
        };
        
        // 라인업 데이터를 JSON 파일로 저장
        const lineupPath = path.join(basePlayerPath, `players_${matchId}_lineup.json`);
        
        // 파일 저장
        await fs.writeFile(lineupPath, JSON.stringify(lineupData, null, 2));
        
        // 데이터베이스에도 저장
        const match = await Match.findByPk(matchId);
        if (match) {
            const matchData = match.match_data || {};
            matchData.lineup = lineupData;
            await match.update({ match_data: matchData });
        }
        
        res.json({ success: true });
    } catch (error) {
        logger.error('라인업 저장 중 오류 발생:', error);
        console.error('라인업 저장 중 오류 발생:', error);
        res.status(500).json({ error: '라인업 저장 중 오류가 발생했습니다.' });
    }
});

// 라인업 불러오기 API
app.get('/api/load-lineup/:matchId', async (req, res) => {
    const { matchId } = req.params;
    
    if (!matchId) {
        return res.status(400).json({ error: '매치 ID가 제공되지 않았습니다.' });
    }
    
    try {
        // 데이터베이스에서 라인업 데이터 확인
        const match = await Match.findByPk(matchId);
        if (match && match.match_data && match.match_data.lineup) {
            return res.json({ success: true, lineup: match.match_data.lineup });
        }
        
        // 파일에서 라인업 데이터 확인
        const lineupPath = path.join(__dirname, 'public', 'PLAYERDATA', `players_${matchId}_lineup.json`);
        
        if (!fsSync.existsSync(lineupPath)) {
            return res.json({ success: true, lineup: null });
        }
        
        const lineupData = await fs.readFile(lineupPath, 'utf8');
        const lineup = JSON.parse(lineupData);
        
        res.json({ success: true, lineup });
    } catch (error) {
        console.error('라인업 불러오기 중 오류 발생:', error);
        res.status(500).json({ error: '라인업 불러오기 중 오류가 발생했습니다.' });
    }
});

// 종목 목록 페이지
app.get('/sports', async (req, res) => {
  try {
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default'],
      order: [['name', 'ASC']]
    });
    res.render('sports', { sports });
  } catch (error) {
    logger.error('종목 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 새 종목 추가 페이지
app.get('/sports/new', (req, res) => {
  res.render('sport-form');
});

// 종목 추가 API
app.post('/api/sport', async (req, res) => {
  try {
    const { name, code, template, description } = req.body;
    
    if (!name || !code || !template) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    const sport = await Sport.create({
      name,
      code: code.toUpperCase(),
      template,
      description
    });

    logger.info('새 종목 생성:', sport.id);
    res.status(201).json(sport);
  } catch (error) {
    logger.error('종목 생성 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 종목 삭제 API
app.delete('/api/sport/:code', async (req, res) => {
  try {
    const code = req.params.code;
    logger.info(`종목 삭제 요청: CODE=${code}`);
    
    // 먼저 종목이 존재하는지 확인
    const sport = await Sport.findOne({
      where: { code: code }
    });

    if (!sport) {
      logger.warn(`종목을 찾을 수 없음: CODE=${code}`);
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }

    // 기본 종목인 경우 삭제 불가
    if (sport.is_default) {
      logger.warn(`기본 종목 삭제 시도: CODE=${code}`);
      return res.status(400).json({ error: '기본 종목은 삭제할 수 없습니다.' });
    }

    // 해당 종목을 사용하는 경기가 있는지 확인
    const matchCount = await Match.count({
      where: { sport_type: code }
    });

    if (matchCount > 0) {
      logger.warn(`사용 중인 종목 삭제 시도: CODE=${code}, 사용 중인 경기 수=${matchCount}`);
      return res.status(400).json({ error: '이 종목을 사용하는 경기가 있어 삭제할 수 없습니다.' });
    }

    // 종목 삭제 (정확한 코드로 삭제)
    const deletedCount = await Sport.destroy({
      where: { 
        code: code,
        is_default: false
      }
    });

    if (deletedCount === 0) {
      logger.warn(`종목 삭제 실패: CODE=${code}`);
      return res.status(400).json({ error: '종목 삭제에 실패했습니다.' });
    }
    
    logger.info(`종목 삭제 성공: CODE=${code}`);
    return res.json({ message: '종목이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    logger.error(`종목 삭제 실패: CODE=${req.params.code}`, error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 템플릿 관리 페이지
app.get('/templates', (req, res) => {
  res.render('templates');
});

app.post('/api/templates', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: '템플릿 이름은 필수입니다.' });
        }

        // 파일명 유효성 검사
        if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
            return res.status(400).json({ error: '템플릿 이름은 영문자, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.' });
        }

        // 이미 존재하는 템플릿인지 확인
        const existingTemplate = await Template.findOne({ where: { name } });
        if (existingTemplate) {
            return res.status(400).json({ error: '이미 존재하는 템플릿 이름입니다.' });
        }

        const viewsDir = path.join(__dirname, 'views');
        const templateFile = path.join(viewsDir, `${name}-template.ejs`);
        const controlFile = path.join(viewsDir, `${name}-control.ejs`);

        // 파일이 이미 존재하는지 확인
        if (fsSync.existsSync(templateFile) || fsSync.existsSync(controlFile)) {
            return res.status(400).json({ error: '이미 존재하는 템플릿 파일입니다.' });
        }

        // 기본 템플릿 파일 복사
        fsSync.copyFileSync(
            path.join(viewsDir, 'soccer-template.ejs'),
            templateFile
        );
        fsSync.copyFileSync(
            path.join(viewsDir, 'soccer-control.ejs'),
            controlFile
        );

        // 템플릿 파일 내용 읽기
        const templateContent = fsSync.readFileSync(templateFile, 'utf8');

        // 템플릿 정보 저장
        const template = await Template.create({
            name: name,
            sport_type: 'soccer',
            template_type: 'overlay',
            is_default: false,
            file_name: `${name}-template.ejs`,
            content: templateContent
        });

        res.json({ 
            id: template.id,
            name: name,
            templateFile: `${name}-template.ejs`,
            controlFile: `${name}-control.ejs`,
            isDefault: false
        });
    } catch (error) {
        logger.error('템플릿 생성 중 오류:', error);
        // 파일 생성은 성공했지만 DB 저장에 실패한 경우 파일 삭제
        try {
            if (fsSync.existsSync(templateFile)) {
                fsSync.unlinkSync(templateFile);
            }
            if (fsSync.existsSync(controlFile)) {
                fsSync.unlinkSync(controlFile);
            }
        } catch (deleteError) {
            logger.error('템플릿 파일 삭제 중 오류:', deleteError);
        }
        res.status(500).json({ error: '템플릿 생성에 실패했습니다.' });
    }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id);
    if (!template) {
      logger.warn(`템플릿을 찾을 수 없음 - ID: ${req.params.id}`);
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }
    
    // 기본 템플릿은 삭제 불가
    if (template.is_default) {
      return res.status(400).json({ error: '기본 템플릿은 삭제할 수 없습니다.' });
    }

    // 파일 삭제
    const viewsDir = path.join(__dirname, 'views');
    const templateFile = path.join(viewsDir, `${template.name}-template.ejs`);
    const controlFile = path.join(viewsDir, `${template.name}-control.ejs`);
    
    logger.info('=== 템플릿 파일 삭제 시도 ===');
    logger.info(`템플릿 이름: ${template.name}`);
    logger.info(`템플릿 파일 경로: ${templateFile}`);
    logger.info(`컨트롤 파일 경로: ${controlFile}`);
    
    // 파일 삭제 시도
    try {
      if (fsSync.existsSync(templateFile)) {
        fsSync.unlinkSync(templateFile);
        logger.info(`템플릿 파일 삭제 성공: ${template.name}-template.ejs`);
      }
      if (fsSync.existsSync(controlFile)) {
        fsSync.unlinkSync(controlFile);
        logger.info(`컨트롤 파일 삭제 성공: ${template.name}-control.ejs`);
      }
    } catch (deleteError) {
      logger.error('파일 삭제 중 오류:', deleteError);
      return res.status(500).json({ error: '템플릿 파일 삭제에 실패했습니다.' });
    }
    
    // 데이터베이스에서 템플릿 삭제
    await template.destroy();
    logger.info('데이터베이스에서 템플릿 삭제 완료');
    
    res.json({ message: '템플릿이 삭제되었습니다.' });
  } catch (error) {
    logger.error('템플릿 삭제 실패:', error);
    res.status(500).json({ error: '템플릿 삭제에 실패했습니다.' });
  }
});

app.get('/templates/:id/edit', async (req, res) => {
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
        // 파일 경로 검증
        const ejsPath = path.join(__dirname, 'views', template.file_name);
        const viewsDir = path.join(__dirname, 'views');
        
        // 파일 경로가 views 디렉토리 내에 있는지 확인
        if (!ejsPath.startsWith(viewsDir)) {
          throw new Error('잘못된 파일 경로입니다.');
        }
        
        // 파일 존재 여부 확인
        try {
          await fs.access(ejsPath);
        } catch (accessError) {
          logger.error(`템플릿 파일 접근 실패: ${ejsPath}`, accessError);
          throw new Error('템플릿 파일을 찾을 수 없습니다.');
        }
        
        // 파일 내용 읽기
        ejsContent = await fs.readFile(ejsPath, 'utf8');
        logger.info(`템플릿 파일 읽기 성공: ${template.file_name}`);
      } else {
        logger.warn(`템플릿 ${template.id}의 파일명이 없습니다.`);
        ejsContent = template.content || '';
      }
    } catch (error) {
      logger.error('EJS 파일 읽기 실패:', error);
      // 파일 읽기 실패 시 데이터베이스의 content 필드 사용
      ejsContent = template.content || '';
    }
    
    res.render('template-edit', { 
      template,
      ejsContent
    });
  } catch (error) {
    logger.error('템플릿 수정 페이지 로드 실패:', error);
    res.status(500).send('템플릿 수정 페이지를 불러오는데 실패했습니다.');
  }
});

app.put('/api/templates/:id', async (req, res) => {
    try {
        const { name, content, is_default } = req.body;
        const template = await Template.findByPk(req.params.id);
        
        if (!template) {
            return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
        }

        // EJS 파일 직접 수정
        const fs = require('fs').promises;
        const path = require('path');
        
        // 파일 이름 생성 (사용자 정의 이름 + -template.ejs 형식)
        const safeName = name.replace(/[^a-zA-Z0-9가-힣]/g, '_');
        const ejsFileName = `${safeName}-template.ejs`;
        const ejsPath = path.join(__dirname, 'views', ejsFileName);
        
        try {
            // 파일 경로 검증
            if (!ejsPath.startsWith(path.join(__dirname, 'views'))) {
                throw new Error('잘못된 파일 경로입니다.');
            }

            // EJS 파일 직접 수정
            await fs.writeFile(ejsPath, content, 'utf8');
            logger.info(`템플릿 파일 수정 완료: ${ejsFileName}`);
            
            // 파일을 다시 읽어서 내용 확인
            const updatedContent = await fs.readFile(ejsPath, 'utf8');
            
            // 이전 파일 삭제 (원본 템플릿이 아닌 경우에만)
            if (template.file_name && template.file_name !== 'soccer-template.ejs') {
                const oldPath = path.join(__dirname, 'views', template.file_name);
                try {
                    await fs.unlink(oldPath);
                    logger.info(`이전 템플릿 파일 삭제 완료: ${template.file_name}`);
                } catch (unlinkError) {
                    logger.warn(`이전 템플릿 파일 삭제 실패: ${template.file_name}`, unlinkError);
                }
            }
            
            // 템플릿 메타데이터 업데이트
            await template.update({
                name,
                content: updatedContent,
                is_default,
                file_name: ejsFileName
            });

            res.json({ 
                message: '템플릿이 성공적으로 수정되었습니다.',
                file_name: ejsFileName,
                content: updatedContent
            });
        } catch (writeError) {
            logger.error('템플릿 파일 수정 실패:', writeError);
            return res.status(500).json({ error: '템플릿 파일 수정에 실패했습니다.' });
        }
    } catch (error) {
        logger.error('템플릿 수정 실패:', error);
        res.status(500).json({ error: '템플릿 수정 중 오류가 발생했습니다.' });
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

// 서버 시작
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DOMAIN = process.env.DOMAIN || 'sportscoder-production.up.railway.app';
server.listen(PORT, HOST, async () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  
  // 기본 종목 초기화
  await initializeDefaultSports();
  
  await restoreMatchTimers();
  try {
    await sequelize.sync({ alter: true });
  } catch (error) {
    logger.error('데이터베이스 동기화 중 오류 발생:', error);
    // 오류가 발생해도 서버는 계속 실행
  }
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
    const matches = await Match.findAll({
      order: [['createdAt', 'DESC']]
    });

    const matchesWithUrls = matches.map(match => ({
      ...match.toJSON(),
      overlay_url: `/${match.sport_type.toLowerCase()}/${match.id}/overlay`,
      control_url: `/${match.sport_type.toLowerCase()}/${match.id}/control`
    }));

    res.json(matchesWithUrls);
  } catch (error) {
    logger.error('경기 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
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
    
    // 해당 스포츠의 컨트롤 템플릿 렌더링
    res.render(`${req.params.sport}-control`, { match });
  } catch (error) {
    logger.error('컨트롤 패널 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
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
    res.render(`${req.params.sport}-template`, { match });
  } catch (error) {
    logger.error('오버레이 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
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