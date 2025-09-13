# SportsCoder 기술 명세서

## 목차
1. [시스템 개요](#1-시스템-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [API 명세](#5-api-명세)
6. [실시간 통신](#6-실시간-통신)
7. [파일 시스템](#7-파일-시스템)
8. [보안](#8-보안)
9. [로깅](#9-로깅)
10. [성능 최적화](#10-성능-최적화)
11. [배포 및 유지보수](#11-배포-및-유지보수)

## 1. 시스템 개요

### 1.1 프로젝트 목적
SportsCoder는 스포츠 경기 중계를 위한 실시간 데이터 관리 및 표시 시스템입니다. 축구와 야구 경기를 지원하며, 실시간으로 경기 데이터를 업데이트하고 오버레이로 표시할 수 있습니다.

### 1.2 주요 기능
- 실시간 경기 데이터 관리
- 팀 로고 및 색상 관리
- 선수 데이터 관리
- 실시간 오버레이 표시
- 커스텀 템플릿 지원
- 다중 클라이언트 지원

## 2. 기술 스택

### 2.1 백엔드
- Node.js v14.0.0 이상
- Express.js v4.17.1
- Socket.IO v4.0.0
- Sequelize ORM v6.6.5
- SQLite3 v5.0.2

### 2.2 프론트엔드
- EJS Template Engine v3.1.6
- Bootstrap v5.0.0
- jQuery v3.6.0
- Socket.IO Client v4.0.0

### 2.3 유틸리티
- Winston Logger v3.3.3
- Multer v1.4.3
- UUID v8.3.2
- Moment.js v2.29.1

## 3. 시스템 아키텍처

### 3.1 디렉토리 구조
```
SportsCoder/
├── models/                 # 데이터베이스 모델
│   ├── index.js           # 모델 초기화
│   ├── Match.js           # 경기 모델
│   ├── Sport.js           # 종목 모델
│   └── Template.js        # 템플릿 모델
├── public/                # 정적 파일
│   ├── TEAMLOGO/         # 팀 로고 저장
│   │   ├── SOCCER/       # 축구 팀 로고
│   │   └── BASEBALL/     # 야구 팀 로고
│   ├── PLAYERDATA/       # 선수 데이터
│   └── temp/             # 임시 파일
├── views/                 # EJS 템플릿
│   ├── soccer-template.ejs
│   ├── soccer-control.ejs
│   ├── baseball-template.ejs
│   └── baseball-control.ejs
├── server.js             # 메인 서버 파일
└── package.json          # 프로젝트 설정
```

### 3.2 모듈 구조
```javascript
// server.js
const express = require('express');
const socketIo = require('socket.io');
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const routes = require('./routes');
const socketHandler = require('./socket');

// 모듈 초기화
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 미들웨어 설정
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// 라우트 설정
app.use('/', routes);

// 소켓 핸들러 설정
socketHandler(io);

// 서버 시작
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

## 4. 데이터베이스 설계

### 4.1 Match 모델
```javascript
module.exports = (sequelize, DataTypes) => {
  const Match = sequelize.define('Match', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sport_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['SOCCER', 'BASEBALL']]
      }
    },
    home_team: {
      type: DataTypes.STRING,
      allowNull: false
    },
    away_team: {
      type: DataTypes.STRING,
      allowNull: false
    },
    home_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    away_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    match_data: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    url: {
      type: DataTypes.STRING,
      unique: true
    }
  });

  return Match;
};
```

### 4.2 Sport 모델
```javascript
module.exports = (sequelize, DataTypes) => {
  const Sport = sequelize.define('Sport', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    template: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  return Sport;
};
```

## 5. API 명세

### 5.1 경기 관리 API

#### 경기 생성
```http
POST /api/match
Content-Type: application/json

{
  "sport_type": "SOCCER",
  "home_team": "홈팀",
  "away_team": "원정팀",
  "match_data": {
    "state": "경기 전",
    "home_shots": 0,
    "away_shots": 0
  }
}

Response:
{
  "id": "uuid",
  "sport_type": "SOCCER",
  "home_team": "홈팀",
  "away_team": "원정팀",
  "url": "soccer-123456-abc123",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

#### 경기 업데이트
```http
PUT /api/match/:id
Content-Type: application/json

{
  "home_score": 2,
  "away_score": 1,
  "match_data": {
    "state": "1차전",
    "home_shots": 10,
    "away_shots": 5
  }
}

Response:
{
  "id": "uuid",
  "home_score": 2,
  "away_score": 1,
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### 5.2 팀 로고 API

#### 로고 업로드
```http
POST /api/upload-logo
Content-Type: multipart/form-data

{
  "logo": File,
  "teamType": "home",
  "sportType": "SOCCER",
  "matchId": "uuid",
  "teamName": "홈팀"
}

Response:
{
  "success": true,
  "logoPath": "/TEAMLOGO/SOCCER/logo.png",
  "bgColor": "#ffffff"
}
```

## 6. 실시간 통신

### 6.1 Socket.IO 이벤트

#### 클라이언트 연결
```javascript
// 서버
io.on('connection', (socket) => {
  socket.on('join', (matchId) => {
    socket.join(`match_${matchId}`);
    logger.info(`Client joined match_${matchId}`);
  });
});

// 클라이언트
const socket = io();
socket.emit('join', matchId);
```

#### 경기 데이터 업데이트
```javascript
// 서버
socket.on('match_update', async (data) => {
  const { matchId, data: matchData } = data;
  const roomName = `match_${matchId}`;
  
  try {
    const match = await Match.findByPk(matchId);
    await match.update(matchData);
    
    io.to(roomName).emit('match_update', {
      id: matchId,
      ...matchData
    });
  } catch (error) {
    logger.error('Match update error:', error);
  }
});

// 클라이언트
socket.on('match_update', (data) => {
  updateMatchDisplay(data);
});
```

## 7. 파일 시스템

### 7.1 로고 파일 관리
```javascript
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'public/TEAMLOGO', req.body.sportType);
      fsSync.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, originalName);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.'));
    }
  }
});
```

### 7.2 JSON 데이터 관리
```javascript
// 팀 로고 매핑 파일 구조
{
  "sport": "SOCCER",
  "teamLogoMap": {
    "홈팀": {
      "path": "/TEAMLOGO/SOCCER/logo.png",
      "bgColor": "#ffffff",
      "matchId": "uuid",
      "teamType": "home",
      "lastUpdated": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## 8. 보안

### 8.1 세션 관리
```javascript
app.use(session({
  secret: 'sports-coder-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
}));
```

### 8.2 CORS 설정
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## 9. 로깅

### 9.1 Winston 설정
```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### 9.2 로그 레벨
- error: 심각한 오류 (예: 데이터베이스 연결 실패)
- warn: 경고 메시지 (예: 파일 업로드 실패)
- info: 일반 정보 (예: 경기 생성)
- debug: 디버깅 정보 (예: 소켓 이벤트)

## 10. 성능 최적화

### 10.1 캐싱 전략
```javascript
// 정적 파일 캐싱
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// 데이터베이스 쿼리 캐싱
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

async function getCachedData(key, fetchFn) {
  if (cache.has(key)) {
    const { data, timestamp } = cache.get(key);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### 10.2 데이터베이스 최적화
```javascript
// 인덱스 설정
Match.addIndex(['sport_type', 'created_at']);
Sport.addIndex(['code']);
Template.addIndex(['name', 'sport_type']);

// 쿼리 최적화
const matches = await Match.findAll({
  where: {
    sport_type: 'SOCCER',
    created_at: {
      [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  },
  order: [['created_at', 'DESC']],
  limit: 10
});
```

## 11. 배포 및 유지보수

### 11.1 서버 시작
```javascript
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

async function startServer() {
  try {
    // 데이터베이스 연결
    await sequelize.authenticate();
    logger.info('Database connection established');
    
    // 기본 데이터 초기화
    await initializeDefaultSports();
    logger.info('Default sports initialized');
    
    // 타이머 상태 복원
    await restoreMatchTimers();
    logger.info('Match timers restored');
    
    // 서버 시작
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();
```

### 11.2 데이터베이스 마이그레이션
```javascript
// 마이그레이션 스크립트
const { sequelize } = require('./models');

async function migrate() {
  try {
    // 데이터베이스 동기화
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
    
    // 기본 데이터 초기화
    await initializeDefaultSports();
    logger.info('Default data initialized');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
```

### 11.3 모니터링
```javascript
// 시스템 리소스 모니터링
const os = require('os');

setInterval(() => {
  const cpuUsage = os.loadavg()[0];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  logger.info('System metrics', {
    cpuUsage,
    memoryUsage: (usedMem / totalMem) * 100,
    uptime: os.uptime()
  });
}, 60000); // 1분마다
```

---

이 기술 명세서는 SportsCoder의 모든 기술적 측면을 상세하게 설명하고 있습니다. 각 컴포넌트는 실제 구현 시 더 자세한 설명이 필요할 수 있으며, 필요에 따라 추가적인 기능이 개발될 수 있습니다. 