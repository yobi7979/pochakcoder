const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

// Sequelize 인스턴스 생성 (환경에 따라 데이터베이스 선택)
let sequelize;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
  // 프로덕션 환경: PostgreSQL 사용
  console.log('PostgreSQL 데이터베이스 연결 시도...');
  try {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log,
      benchmark: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
    console.log('PostgreSQL 연결 설정 완료');
  } catch (error) {
    console.error('PostgreSQL 연결 설정 실패:', error);
    console.log('SQLite로 대체합니다...');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: path.join(__dirname, '../sports.db'),
      logging: console.log,
      benchmark: false
    });
  }
} else {
  // 개발 환경 또는 DATABASE_URL이 없는 경우: SQLite 사용
  console.log('SQLite 데이터베이스 연결 시도...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../sports.db'),
    logging: console.log,
    benchmark: false
  });
}

// Match 모델 정의
const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
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
  home_team_header: {
    type: DataTypes.STRING,
    defaultValue: 'HOME'
  },
  away_team_header: {
    type: DataTypes.STRING,
    defaultValue: 'AWAY'
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
    defaultValue: 'pending'
  },
  match_data: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'Matches'
});

// Template 모델 정의
const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sport_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  template_type: {
    type: DataTypes.ENUM('control', 'overlay'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'templates',
  underscored: true
});

// Sport 모델 정의
const Sport = sequelize.define('Sport', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'Sports'
});

// SportOverlayImage 모델 정의
const SportOverlayImage = sequelize.define('SportOverlayImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sport_code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  upload_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'SportOverlayImages'
});

// Sport와 SportOverlayImage 간의 관계 설정
Sport.hasMany(SportOverlayImage, { foreignKey: 'sport_code', sourceKey: 'code' });
SportOverlayImage.belongsTo(Sport, { foreignKey: 'sport_code', targetKey: 'code' });

// SportActiveOverlayImage 모델 정의 (종목별 현재 사용 중인 이미지)
const SportActiveOverlayImage = sequelize.define('SportActiveOverlayImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sport_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
  active_image_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  active_image_path: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'SportActiveOverlayImages',
  indexes: [
    {
      unique: true,
      fields: ['sport_code', 'active_image_id']
    }
  ]
});

// Sport와 SportActiveOverlayImage 간의 관계 설정
Sport.hasOne(SportActiveOverlayImage, { foreignKey: 'sport_code', sourceKey: 'code' });
SportActiveOverlayImage.belongsTo(Sport, { foreignKey: 'sport_code', targetKey: 'code' });

// SportOverlayImage와 SportActiveOverlayImage 간의 관계 설정
SportOverlayImage.hasOne(SportActiveOverlayImage, { foreignKey: 'active_image_id', sourceKey: 'id' });
SportActiveOverlayImage.belongsTo(SportOverlayImage, { foreignKey: 'active_image_id', targetKey: 'id' });

// Settings 모델 정의
const Settings = sequelize.define('Settings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'Settings'
});

// User 모델 정의
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 50],
      notEmpty: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255],
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user',
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'users',
  indexes: [
    {
      unique: true,
      fields: ['username']
    },
    {
      fields: ['email']
    },
    {
      fields: ['is_active']
    }
  ]
});

// MatchList 모델 정의
const MatchList = sequelize.define('MatchList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  matches: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  custom_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pushed_match_id: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  pushed_match_index: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  pushed_timestamp: {
    type: DataTypes.BIGINT,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'MatchLists'
});

// UserSportPermission 모델 정의 (사용자별 종목 권한)
const UserSportPermission = sequelize.define('UserSportPermission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  sport_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Sports',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'UserSportPermissions',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'sport_id']
    }
  ]
});

// 경기 생성 시 스포츠 타입에 따른 기본 데이터 구조 설정
Match.beforeCreate((match) => {
  // 날짜와 종목 코드를 조합한 ID 생성
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateCode = `${month}${day}`;
  
  // 종목 코드 설정
  let sportCode = '';
  if (match.sport_type === 'soccer') {
    sportCode = 'SC';
  } else if (match.sport_type === 'baseball') {
    sportCode = 'BB';
  }
  
  // 현재 시간을 밀리초로 가져와서 순번으로 사용
  const timestamp = Date.now();
  const sequence = String(timestamp % 10000).padStart(4, '0');  // 4자리 숫자로 확장
  
  // 새 ID 설정: 날짜 + 종목코드 + 순번
  match.id = `${dateCode}${sportCode}${sequence}`;
  
  // 기본 경기 데이터 설정
  if (match.sport_type === 'soccer') {
    match.match_data = {
      ...match.match_data,
      state: '전반',
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
    };
  } else if (match.sport_type === 'baseball') {
    match.match_data = {
      ...match.match_data,
      current_inning: 1,
      inning_type: 'top',
      first_base: false,
      second_base: false,
      third_base: false,
      balls: 0,
      strikes: 0,
      outs: 0,
      batter_name: '',
      batter_number: '',
      batter_position: '',
      batter_avg: '',
      pitcher_name: '',
      pitcher_number: '',
      pitcher_position: '',
      pitcher_era: '',
      home_hits: 0,
      away_hits: 0,
      home_errors: 0,
      away_errors: 0,
      innings: {},
      timer: 0,
      lastUpdateTime: Date.now(),
      isRunning: false
    };
  }
});

// Sport와 User 간의 관계 설정
Sport.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Sport, { foreignKey: 'created_by' });

// Sport와 Template 간의 관계 설정
Sport.belongsTo(Template, { 
  foreignKey: 'template', 
  targetKey: 'name', 
  as: 'templateInfo',
  constraints: false
});
Template.hasMany(Sport, { 
  foreignKey: 'template', 
  sourceKey: 'name',
  as: 'sports',
  constraints: false
});

// Match와 User 간의 관계 설정
Match.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Match, { foreignKey: 'created_by' });

// Template와 User 간의 관계 설정
Template.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Template, { foreignKey: 'created_by' });

// MatchList와 User 간의 관계 설정
MatchList.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(MatchList, { foreignKey: 'created_by' });

// UserSportPermission과 User, Sport 간의 관계 설정
UserSportPermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserSportPermission.belongsTo(Sport, { foreignKey: 'sport_id', as: 'sport' });
User.hasMany(UserSportPermission, { foreignKey: 'user_id', as: 'sportPermissions' });
Sport.hasMany(UserSportPermission, { foreignKey: 'sport_id', as: 'userPermissions' });

// TeamInfo 모델 정의
const TeamInfo = sequelize.define('TeamInfo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  match_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Matches',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  sport_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'SOCCER'
  },
  team_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  team_type: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [['home', 'away']]
    }
  },
  team_color: {
    type: DataTypes.STRING(7),
    defaultValue: '#000000'
  },
  team_header: {
    type: DataTypes.STRING
  },
  logo_path: {
    type: DataTypes.STRING(500),
    defaultValue: null
  },
  logo_bg_color: {
    type: DataTypes.STRING(7),
    defaultValue: '#FFFFFF'
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'TeamInfo'
});

// TeamInfo와 Match 간의 관계 설정
TeamInfo.belongsTo(Match, { foreignKey: 'match_id', as: 'match' });
Match.hasMany(TeamInfo, { foreignKey: 'match_id', as: 'teamInfo' });

// 데이터베이스 연결 및 테이블 생성
sequelize.sync()
  .then(() => {
    // 연결 성공 로그 제거
  })
  .catch(err => {
    console.error('데이터베이스 연결 실패:', err);
  });

module.exports = {
  sequelize,
  Match,
  Template,
  Sport,
  SportOverlayImage,
  SportActiveOverlayImage,
  Settings,
  MatchList,
  User,
  UserSportPermission,
  TeamInfo,
  Op
}; 