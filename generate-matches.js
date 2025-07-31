// 50개의 임의 경기 데이터를 생성하는 스크립트
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// 데이터베이스 연결 설정
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

// 임의의 팀 이름 배열
const soccerTeams = [
  '서울 FC', '부산 유나이티드', '인천 레드포스', '대구 블루윙즈', '광주 FC', 
  '전북 현대', '울산 현대', '포항 스틸러스', '성남 FC', '수원 삼성',
  '강원 FC', '제주 유나이티드', '안양 FC', '안산 그리너스', '김천 상무'
];

const baseballTeams = [
  '두산 베어스', '한화 이글스', 'LG 트윈스', '롯데 자이언츠', 'NC 다이노스',
  'KT 위즈', 'SSG 랜더스', '키움 히어로즈', '삼성 라이온즈', 'KIA 타이거즈'
];

const sportTypes = ['soccer', 'baseball'];
const teamColors = [
  '#1d4ed8', '#dc2626', '#16a34a', '#ea580c', '#7e22ce', 
  '#0f766e', '#db2777', '#4f46e5', '#ca8a04', '#0369a1',
  '#84cc16', '#64748b', '#f97316', '#9333ea', '#14b8a6'
];

// Match 모델 정의
const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sport_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  home_team: {
    type: DataTypes.STRING,
    allowNull: false
  },
  away_team: {
    type: DataTypes.STRING,
    allowNull: false
  },
  home_team_color: {
    type: DataTypes.STRING,
    defaultValue: '#1e40af'
  },
  away_team_color: {
    type: DataTypes.STRING,
    defaultValue: '#1e40af'
  },
  home_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  away_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  },
  match_data: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'Matches',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 임의의 경기 데이터 생성 함수
function generateRandomMatch() {
  const sportType = sportTypes[Math.floor(Math.random() * sportTypes.length)];
  const teams = sportType === 'soccer' ? soccerTeams : baseballTeams;
  
  // 중복되지 않는 두 팀 선택
  let homeTeamIndex = Math.floor(Math.random() * teams.length);
  let awayTeamIndex;
  do {
    awayTeamIndex = Math.floor(Math.random() * teams.length);
  } while (homeTeamIndex === awayTeamIndex);
  
  const homeTeam = teams[homeTeamIndex];
  const awayTeam = teams[awayTeamIndex];
  
  // 임의의 점수 생성 (0-7)
  const homeScore = Math.floor(Math.random() * 8);
  const awayScore = Math.floor(Math.random() * 8);
  
  // 임의의 팀 색상 선택
  const homeTeamColor = teamColors[Math.floor(Math.random() * teamColors.length)];
  const awayTeamColor = teamColors[Math.floor(Math.random() * teamColors.length)];
  
  // 경기 기본 데이터
  const match = {
    sport_type: sportType,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: homeScore,
    away_score: awayScore,
    home_team_color: homeTeamColor,
    away_team_color: awayTeamColor,
    status: 'active',
    match_data: {}
  };
  
  // 스포츠 종목별 추가 데이터
  if (sportType === 'soccer') {
    match.match_data = {
      state: ['전반', '전반종료', '후반', '후반종료', '경기종료'][Math.floor(Math.random() * 5)],
      home_shots: Math.floor(Math.random() * 20),
      away_shots: Math.floor(Math.random() * 20),
      home_shots_on_target: Math.floor(Math.random() * 10),
      away_shots_on_target: Math.floor(Math.random() * 10),
      home_corners: Math.floor(Math.random() * 12),
      away_corners: Math.floor(Math.random() * 12),
      home_fouls: Math.floor(Math.random() * 15),
      away_fouls: Math.floor(Math.random() * 15),
      timer: Math.floor(Math.random() * 90 * 60), // 최대 90분
      lastUpdateTime: Date.now(),
      isRunning: Math.random() > 0.5
    };
  } else {
    // 야구 경기 데이터
    match.match_data = {
      inning: Math.floor(Math.random() * 9) + 1,
      inning_half: Math.random() > 0.5 ? 'top' : 'bottom',
      balls: Math.floor(Math.random() * 4),
      strikes: Math.floor(Math.random() * 3),
      outs: Math.floor(Math.random() * 3),
      bases: {
        first: Math.random() > 0.7,
        second: Math.random() > 0.8,
        third: Math.random() > 0.9
      },
      innings_score: {
        home: Array.from({length: 9}, () => Math.floor(Math.random() * 3)),
        away: Array.from({length: 9}, () => Math.floor(Math.random() * 3))
      }
    };
  }
  
  return match;
}

// 메인 함수: 50개의 경기 데이터 생성 및 저장
async function generateMatches() {
  try {
    // 데이터베이스 초기화
    await sequelize.authenticate();
    console.log('데이터베이스 연결 성공');
    
    // 50개의 경기 데이터 생성
    const matches = [];
    for (let i = 0; i < 50; i++) {
      matches.push(generateRandomMatch());
    }
    
    // 한 번에 모든 데이터 저장
    await Match.bulkCreate(matches);
    
    console.log('50개의 임의 경기 데이터가 성공적으로 생성되었습니다.');
    process.exit(0);
  } catch (error) {
    console.error('데이터 생성 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
generateMatches(); 