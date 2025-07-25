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
const io = socketIo(server);

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

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', async () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  
  // 기본 종목 초기화
  await initializeDefaultSports();
  
  await restoreMatchTimers();
  await sequelize.sync({ alter: true });
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

    const matchesWithUrls = matches.map(match => ({
      ...match.toJSON(),
      overlay_url: `/${match.sport_type.toLowerCase()}/${match.id}/overlay`,
      control_url: `/${match.sport_type.toLowerCase()}/${match.id}/control`
    }));

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
    
    // 해당 스포츠의 컨트롤 템플릿 렌더링
    res.render(`${req.params.sport}-control`, { 
      match: {
        ...match.toJSON(),
        home_score: homeScore,
        away_score: awayScore
      }
    });
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

// 404 에러 핸들러 추가
app.use((req, res, next) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 전역 에러 핸들러 추가
app.use((err, req, res, next) => {
  logger.error('서버 오류:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});
