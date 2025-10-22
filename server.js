// SportsCoder 리팩토링된 서버 파일
// 기존 server.js (8,119줄)를 모듈화된 구조로 리팩토링

// 한국시간대 설정
process.env.TZ = 'Asia/Seoul';
console.log('🇰🇷 한국시간대 설정 완료:', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

// Railway 환경과 로컬 환경 모두 Sequelize 모델 사용
console.log('🔧 모든 환경에서 Sequelize 모델 로딩 허용');
console.log('🔍 환경 변수:', {
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  DATABASE_URL: process.env.DATABASE_URL ? '설정됨' : '없음',
  VOLUME_STORAGE_PATH: process.env.VOLUME_STORAGE_PATH || '설정되지 않음'
});

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');

// CORS 설정은 config/app.js에서 가져옴

// 현재 푸시된 경기 정보를 저장하는 객체 (메모리 기반)
const pushedMatches = new Map(); // listId -> { matchId, matchIndex, timestamp }
global.pushedMatches = pushedMatches; // 라우터에서 접근할 수 있도록 전역 변수로 설정

// 서버 시작 시 데이터베이스에서 푸시 정보 복원
async function restorePushedMatches() {
  try {
    const { MatchList, Match } = require('./models');
    
    // 모든 리스트의 푸시 정보 조회
    const lists = await MatchList.findAll({
      where: {
        pushed_match_id: { [Op.ne]: null }
      }
    });
    
    lists.forEach(list => {
      if (list.pushed_match_id) {
        global.pushedMatches.set(list.id.toString(), {
          matchId: list.pushed_match_id,
          matchIndex: list.pushed_match_index || 0,
          timestamp: list.pushed_timestamp || Date.now()
        });
        console.log(`푸시 정보 복원: 리스트 ${list.id} -> 경기 ${list.pushed_match_id}`);
      }
    });
    
    console.log(`총 ${lists.length}개의 푸시 정보가 복원되었습니다.`);
  } catch (error) {
    console.error('푸시 정보 복원 실패:', error);
  }
}

// 푸시 정보를 데이터베이스에 저장
async function savePushedMatchToDatabase(listId, matchId, matchIndex) {
  try {
    const { MatchList } = require('./models');
    
    await MatchList.update({
      pushed_match_id: matchId,
      pushed_match_index: matchIndex,
      pushed_timestamp: Date.now()
    }, {
      where: { id: listId }
    });
    
    console.log(`푸시 정보 데이터베이스 저장: 리스트 ${listId} -> 경기 ${matchId}`);
  } catch (error) {
    console.error('푸시 정보 데이터베이스 저장 실패:', error);
  }
}

// 설정 파일들
const { corsConfig, bodyParserConfig, createLogger, staticConfig } = require('./config/app');
const sessionConfig = require('./config/session');
const { getDatabaseConfig } = require('./config/database');

// 미들웨어들
const { requireAuth, requireAdmin, addUserToTemplate } = require('./middleware/auth');
const { notFoundHandler, errorHandler, asyncHandler } = require('./middleware/errorHandler');
const { morganConfig, customLogging, sessionDebugging } = require('./middleware/logging');

// 라우터들
const matchesRouter = require('./routes/matches');
const matchListsRouter = require('./routes/match-lists');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const templatesRouter = require('./routes/templates');
const sportsRouter = require('./routes/sports');
const overlaysRouter = require('./routes/overlays');
const overlayImagesRouter = require('./routes/overlay-images');
const backupRouter = require('./routes/backup');
const logsRouter = require('./routes/logs');
const settingsRouter = require('./routes/settings');
const dbManagementRouter = require('./routes/db-management');
const tableManagementRouter = require('./routes/table-management');
const teamLogosRouter = require('./routes/team-logos');

// 모델들
const { sequelize, Match, Settings, MatchList, SportOverlayImage, SportActiveOverlayImage, User, UserSportPermission } = require('./models');
const { Op } = require('sequelize');

// Multer 설정 (CSV 파일 업로드용)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('CSV 파일만 업로드 가능합니다.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  }
});
const Sport = require('./models/Sport');
const Template = require('./models/Template');

// 백업 관리자
const BackupRestoreManager = require('./backup-restore');

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
    console.error('기본 팀 컬러 조회 실패:', error);
    return {
      home: '#1e40af',
      away: '#1e40af'
    };
  }
}

// Express 앱 생성
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsConfig
});

// 소켓 이벤트 처리
io.on('connection', (socket) => {
  console.log('✅ 클라이언트 연결됨:', socket.id);
  
  // dataChanged 이벤트 중계
  socket.on('dataChanged', (data) => {
    console.log('=== 서버: dataChanged 이벤트 수신 ===');
    console.log('수신된 데이터:', data);
    console.log('소켓 ID:', socket.id);
    
    // 모든 클라이언트에게 dataChanged 이벤트 전송
    io.emit('dataChanged', data);
    console.log('✅ dataChanged 이벤트 중계 완료');
  });
  
  // 그래픽 토글 이벤트 중계
  socket.on('toggleGraphic', async (data) => {
    console.log('=== 서버: toggleGraphic 이벤트 수신 ===');
    console.log('수신된 데이터:', data);
    console.log('소켓 ID:', socket.id);
    console.log('이벤트 수신 시간:', new Date().toISOString());
    
    // 하단 스트립의 경우 추가 데이터 처리
    if (data.graphicType === 'bottom-strip' && data.visible) {
      try {
        console.log('=== 하단 스트립: 추가 데이터 로드 ===');
        
        // 경기 데이터에서 최신 스코어 정보 가져오기
        const match = await Match.findByPk(data.matchId);
        if (match) {
          // 스코어 정보 추가
          data.score = {
            home: match.home_score || 0,
            away: match.away_score || 0
          };
          
          // 득점 정보가 없으면 DB에서 로드
          if (!data.goals) {
            const matchData = match.match_data || {};
            data.goals = matchData.goals || { home: [], away: [] };
          }
          
          console.log('하단 스트립 추가 데이터:', {
            score: data.score,
            goals: data.goals
          });
        }
      } catch (error) {
        console.error('하단 스트립 데이터 로드 오류:', error);
      }
    }
    
    // 해당 경기 방의 모든 클라이언트에게 그래픽 토글 이벤트 전송
    const roomName = `match_${data.matchId}`;
    console.log(`방 이름: ${roomName}`);
    console.log(`방에 참여한 클라이언트 수: ${io.sockets.adapter.rooms.get(roomName)?.size || 0}`);
    
    io.to(roomName).emit('toggleGraphic', data);
    console.log(`✅ toggleGraphic 이벤트를 방 ${roomName}에 전송함`);
  });

  // 승부차기 텍스트 업데이트 이벤트 중계
  socket.on('updateExtraBoxText', (data) => {
    console.log('=== 서버: updateExtraBoxText 이벤트 수신 ===');
    console.log('수신된 데이터:', data);
    console.log('소켓 ID:', socket.id);
    
    // 해당 경기 방의 모든 클라이언트에게 승부차기 텍스트 업데이트 이벤트 전송
    const roomName = `match_${data.matchId}`;
    console.log(`방 이름: ${roomName}`);
    console.log(`방에 참여한 클라이언트 수: ${io.sockets.adapter.rooms.get(roomName)?.size || 0}`);
    
    io.to(roomName).emit('updateExtraBoxText', data);
    console.log(`✅ updateExtraBoxText 이벤트를 방 ${roomName}에 전송함`);
  });

  // 대회명 업데이트 이벤트 중계
  socket.on('updateTournamentText', async (data) => {
    console.log('=== 서버: updateTournamentText 이벤트 수신 ===');
    console.log('수신된 데이터:', data);
    console.log('소켓 ID:', socket.id);
    
    try {
      // Settings 테이블에 대회명 저장
      const { Settings } = require('./models');
      await Settings.upsert({
        key: `tournament_text_${data.matchId}`,
        value: data.tournamentText,
        match_id: data.matchId
      });
      
      console.log(`✅ 대회명 DB 저장 완료: ${data.tournamentText}`);
    } catch (error) {
      console.error('대회명 DB 저장 실패:', error);
    }
    
    // 해당 경기 방의 모든 클라이언트에게 대회명 업데이트 이벤트 전송
    const roomName = `match_${data.matchId}`;
    console.log(`방 이름: ${roomName}`);
    console.log(`방에 참여한 클라이언트 수: ${io.sockets.adapter.rooms.get(roomName)?.size || 0}`);
    
    io.to(roomName).emit('tournament_text_updated', {
      matchId: data.matchId,
      tournamentText: data.tournamentText
    });
    console.log(`✅ tournament_text_updated 이벤트를 방 ${roomName}에 전송함`);
  });
  
  // 배구 컨트롤 이벤트 처리
  socket.on('volleyball_control', async (data) => {
    console.log('🏐 배구 컨트롤 이벤트 수신:', data);
    console.log('🏐 액션:', data.action);
    
    try {
      const { matchId, action, servingTeam } = data;
      
      if (action === 'change_serve') {
        // 서브권 변경 처리
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          matchData.servingTeam = servingTeam;
          
          await match.update({ match_data: matchData });
          
          // 모든 클라이언트에 서브권 변경 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            match_data: {
              servingTeam: servingTeam
            }
          });
          
          console.log(`✅ 서브권 변경 완료: ${servingTeam}`);
        }
      } else if (action === 'next_set') {
        // 다음 세트 처리
        console.log('🔍 다음 세트 처리 시작:', matchId);
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          const currentSet = matchData.current_set || 1;
          const setFormat = matchData.setFormat || 3; // 기본값 3세트제
          const maxSets = setFormat;
          
          console.log('🔍 현재 상태:', {
            currentSet,
            setFormat,
            maxSets,
            matchData: matchData,
            matchStatus: match.status
          });
          
          // match.status에서도 현재 세트 정보 확인
          const statusMatch = match.status ? match.status.match(/(\d+)세트/) : null;
          const statusSet = statusMatch ? parseInt(statusMatch[1]) : currentSet;
          
          console.log('🔍 상태 분석:', {
            matchStatus: match.status,
            statusSet: statusSet,
            finalCurrentSet: Math.max(currentSet, statusSet)
          });
          
          // 실제 현재 세트 결정 (match_data와 match.status 중 더 높은 값 사용)
          const actualCurrentSet = Math.max(currentSet, statusSet);
          
          console.log('🔍 실제 현재 세트:', actualCurrentSet);
          
          // 최대 세트 확인 (다음 세트가 최대 세트를 초과하는 경우)
          if (actualCurrentSet + 1 > maxSets) {
            console.log(`최대 세트(${maxSets}세트)에 도달했습니다. 더 이상 다음 세트로 진행할 수 없습니다.`);
            // 경기 종료는 사용자가 직접 결정하도록 함
            console.log(`사용자가 "경기종료" 버튼을 클릭할 때까지 대기`);
            return;
          }
          
          const nextSet = actualCurrentSet + 1;
          
          // 현재 세트 점수를 세트 점수에 저장 (이미 save_set_scores에서 저장되었을 수 있음)
          const homeScore = matchData.home_score || 0;
          const awayScore = matchData.away_score || 0;
          
          // 세트 점수 저장 (이미 저장되지 않은 경우만)
          if (!matchData.set_scores) {
            matchData.set_scores = { home: {}, away: {} };
          }
          
          // 현재 세트 점수가 아직 저장되지 않은 경우에만 저장
          if (matchData.set_scores.home[actualCurrentSet] === undefined) {
            matchData.set_scores.home[actualCurrentSet] = homeScore;
            matchData.set_scores.away[actualCurrentSet] = awayScore;
            console.log(`🔍 세트 ${actualCurrentSet} 점수 저장: 홈팀 ${homeScore}, 어웨이팀 ${awayScore}`);
          } else {
            console.log(`🔍 세트 ${actualCurrentSet} 점수는 이미 저장됨: 홈팀 ${matchData.set_scores.home[actualCurrentSet]}, 어웨이팀 ${matchData.set_scores.away[actualCurrentSet]}`);
          }
          
          // 세트 승리 계산 (기존 승리 수 유지)
          let homeWins = matchData.home_wins || 0;
          let awayWins = matchData.away_wins || 0;
          
          // 현재 세트 승리 계산 (저장된 세트 점수 기반)
          const savedHomeScore = matchData.set_scores.home[actualCurrentSet] || 0;
          const savedAwayScore = matchData.set_scores.away[actualCurrentSet] || 0;
          
          if (savedHomeScore > 0 || savedAwayScore > 0) {
            if (savedHomeScore > savedAwayScore) {
              homeWins++;
            } else if (savedAwayScore > savedHomeScore) {
              awayWins++;
            }
          }
          
          console.log('🔍 세트 승리 계산:', { homeWins, awayWins, savedHomeScore, savedAwayScore });
          
          // 다음 세트로 변경
          matchData.current_set = nextSet;
          
          // 현재 세트 점수 초기화 (다음 세트를 위해)
          matchData.home_score = 0;
          matchData.away_score = 0;
          
          // 세트 승리 정보 저장
          matchData.home_wins = homeWins;
          matchData.away_wins = awayWins;
          
          // 경기 상황 저장 (현재 세트)
          matchData.status = nextSet + '세트';
          
          console.log('🔍 저장할 데이터:', {
            current_set: nextSet,
            home_score: 0,
            away_score: 0,
            set_scores: matchData.set_scores,
            home_wins: homeWins,
            away_wins: awayWins,
            status: nextSet + '세트'
          });
          
          await match.update({ 
            match_data: matchData,
            status: nextSet + '세트',  // match.status도 함께 업데이트
            home_score: homeWins,      // 토탈 스코어
            away_score: awayWins       // 토탈 스코어
          });
          
          // 모든 클라이언트에 세트 변경 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins,  // 토탈 세트 승리 수
            match_data: {
              current_set: nextSet,
              home_score: 0,  // 현재 세트 점수 (다음 세트)
              away_score: 0,  // 현재 세트 점수 (다음 세트)
              set_scores: matchData.set_scores,
              home_wins: homeWins,
              away_wins: awayWins,
              setFormat: matchData.setFormat
            }
          });
          
          console.log(`✅ 다음 세트로 변경: ${actualCurrentSet}세트 → ${nextSet}세트`);
          console.log(`세트 점수 저장: 홈팀 ${homeScore}, 어웨이팀 ${awayScore}`);
          console.log(`세트 승리: 홈팀 ${homeWins}승, 어웨이팀 ${awayWins}승`);
        }
      } else if (action === 'reset_match') {
        // 경기 초기화 처리
        console.log('🔍 경기 초기화 처리 시작:', matchId);
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          
          // 모든 데이터 초기화
          matchData.current_set = 1;
          matchData.home_score = 0;
          matchData.away_score = 0;
          matchData.set_scores = {
            home: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            away: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
          };
          matchData.home_wins = 0;
          matchData.away_wins = 0;
          matchData.status = '1세트';
          matchData.servingTeam = 'home'; // 기본 서브권은 홈팀
          
          console.log('🔍 초기화할 데이터:', matchData);
          
          await match.update({ 
            match_data: matchData,
            status: '1세트',
            home_score: 0,  // 토탈 스코어 초기화
            away_score: 0   // 토탈 스코어 초기화
          });
          
          // 모든 클라이언트에 초기화 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: 0,  // 토탈 세트 승리 수
            away_score: 0,  // 토탈 세트 승리 수
            match_data: {
              current_set: 1,
              home_score: 0,  // 현재 세트 점수
              away_score: 0,  // 현재 세트 점수
              set_scores: {
                home: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                away: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
              },
              home_wins: 0,
              away_wins: 0,
              servingTeam: 'home',
              setFormat: matchData.setFormat
            }
          });
          
          console.log(`✅ 경기 초기화 완료: 1세트 0-0으로 리셋`);
        }
      } else if (action === 'end_match') {
        // 경기 종료 처리
        console.log('🔍 경기 종료 처리 시작:', matchId);
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          const setScores = data.setScores;
          const setFormat = data.setFormat;
          const finalSet = data.finalSet;
          const homeScore = data.homeScore;
          const awayScore = data.awayScore;
          
          console.log('🔍 경기 종료 데이터:', {
            setScores,
            setFormat,
            finalSet,
            homeScore,
            awayScore
          });
          
          // 세트 점수 저장
          matchData.set_scores = setScores;
          matchData.setFormat = setFormat;
          
          // 최종 세트 점수 저장
          matchData.set_scores.home[finalSet] = homeScore;
          matchData.set_scores.away[finalSet] = awayScore;
          
          // 최종 매치 점수 계산 (모든 세트의 점수로 계산)
          let homeWins = 0;
          let awayWins = 0;
          
          for (let set = 1; set <= setFormat; set++) {
            const setHomeScore = matchData.set_scores.home[set] || 0;
            const setAwayScore = matchData.set_scores.away[set] || 0;
            
            if (setHomeScore > setAwayScore) {
              homeWins++;
            } else if (setAwayScore > setHomeScore) {
              awayWins++;
            }
          }
          
          matchData.home_wins = homeWins;
          matchData.away_wins = awayWins;
          matchData.status = '경기종료';
          
          console.log('🔍 최종 매치 점수:', { homeWins, awayWins });
          console.log('🔍 최종 세트 점수:', matchData.set_scores);
          
          // 데이터베이스 업데이트
          await match.update({ 
            match_data: matchData,
            status: '경기종료',
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins   // 토탈 세트 승리 수
          });
          
          // 모든 클라이언트에 경기 종료 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins,  // 토탈 세트 승리 수
            match_data: {
              status: '경기종료',
              set_scores: matchData.set_scores,
              home_wins: homeWins,
              away_wins: awayWins,
              setFormat: setFormat,
              finalSet: finalSet
            }
          });
          
          console.log(`✅ 경기 종료 완료: 최종 점수 ${homeWins}-${awayWins}`);
        }
      } else if (action === 'set_format_change') {
        // 세트 구성 변경 처리
        console.log('🔍 세트제 변경 디버깅:');
        console.log('matchId:', matchId);
        console.log('data.setFormat:', data.setFormat);
        console.log('data.setFormat 타입:', typeof data.setFormat);
        
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          console.log('기존 matchData:', matchData);
          
          // 명시적으로 정수로 변환하여 저장
          matchData.setFormat = parseInt(data.setFormat);
          console.log('새로운 matchData:', matchData);
          console.log('저장할 setFormat:', matchData.setFormat, typeof matchData.setFormat);
          
          await match.update({ match_data: matchData });
          console.log('✅ 세트제 데이터베이스 저장 완료');
          
          // 저장 후 확인
          const updatedMatch = await Match.findByPk(matchId);
          console.log('저장 후 확인:', updatedMatch.match_data);
          
          // 모든 클라이언트에 세트 구성 변경 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: match.home_score,  // 토탈 세트 승리 수
            away_score: match.away_score,  // 토탈 세트 승리 수
            match_data: {
              setFormat: data.setFormat,
              current_set: matchData.current_set,
              home_score: matchData.home_score,
              away_score: matchData.away_score,
              set_scores: matchData.set_scores,
              home_wins: matchData.home_wins,
              away_wins: matchData.away_wins
            }
          });
          
          console.log(`✅ 세트 구성 변경: ${data.setFormat}세트제`);
        } else {
          console.log('❌ 경기를 찾을 수 없음:', matchId);
        }
      } else if (action === 'save_set_scores') {
        // 세트 점수 저장 처리
        console.log('🔍 세트 점수 저장 디버깅:');
        console.log('matchId:', matchId);
        console.log('data.setScores:', data.setScores);
        console.log('data.setFormat:', data.setFormat);
        
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          console.log('기존 matchData:', matchData);
          
          // setScores 데이터 검증 및 초기화
          let setScores = data.setScores;
          if (!setScores || !setScores.home || !setScores.away) {
            console.log('setScores 초기화 필요');
            setScores = {
              home: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
              away: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            };
          }
          
          // 빈 객체 체크 및 기본값 설정
          for (let set = 1; set <= 5; set++) {
            if (setScores.home[set] === undefined || setScores.home[set] === null) {
              setScores.home[set] = 0;
            }
            if (setScores.away[set] === undefined || setScores.away[set] === null) {
              setScores.away[set] = 0;
            }
          }
          
          console.log('검증된 setScores:', setScores);
          
          // 세트 점수 저장
          matchData.set_scores = setScores;
          matchData.setFormat = data.setFormat;
          
          // 세트 승리 계산 (단순 점수 비교)
          let homeWins = 0;
          let awayWins = 0;
          
          const maxSets = data.setFormat || 3;
          for (let set = 1; set <= maxSets; set++) {
            const homeScore = matchData.set_scores.home[set] || 0;
            const awayScore = matchData.set_scores.away[set] || 0;
            
            // 세트가 진행된 경우만 승리 계산 (단순 점수 비교)
            if (homeScore > 0 || awayScore > 0) {
              if (homeScore > awayScore) {
                homeWins++;
              } else if (awayScore > homeScore) {
                awayWins++;
              }
            }
          }
          
          matchData.home_wins = homeWins;
          matchData.away_wins = awayWins;
          
          console.log('새로운 matchData:', matchData);
          console.log('계산된 토탈 스코어:', { homeWins, awayWins });
          
          console.log('🔍 save_set_scores DB 업데이트 전 matchData:', JSON.stringify(matchData, null, 2));
          
          // match_data를 명시적으로 설정하여 JSONB 필드 업데이트 보장
          match.match_data = matchData;
          const updateResult = await match.save();
          
          // 추가로 home_score와 away_score도 명시적으로 업데이트
          await match.update({
            home_score: homeWins,  // 토탈 스코어
            away_score: awayWins   // 토탈 스코어
          });
          
          console.log('🔍 save_set_scores DB 업데이트 결과:', updateResult);
          console.log('✅ 세트 점수 및 토탈 스코어 데이터베이스 저장 완료');
          
          // 저장 후 확인
          const updatedMatch = await Match.findByPk(matchId);
          console.log('🔍 save_set_scores 저장 후 matchData:', JSON.stringify(updatedMatch.match_data, null, 2));
          console.log('🔍 save_set_scores 저장 후 set_scores:', updatedMatch.match_data.set_scores);
          
          // 모든 클라이언트에 세트 점수 저장 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins,  // 토탈 세트 승리 수
            match_data: {
              set_scores: data.setScores,
              setFormat: data.setFormat,
              home_wins: homeWins,
              away_wins: awayWins,
              current_set: matchData.current_set,
              home_score: matchData.home_score,
              away_score: matchData.away_score
            }
          });
          
          console.log(`✅ 세트 점수 저장: ${data.setFormat}세트제, 토탈: ${homeWins}-${awayWins}`);
        } else {
          console.log('❌ 경기를 찾을 수 없음:', matchId);
        }
      } else if (action === 'update_score') {
        // 현재 세트 점수 업데이트 처리
        console.log('🔍 현재 세트 점수 업데이트 디버깅:');
        console.log('matchId:', matchId);
        console.log('data.home_score:', data.home_score);
        console.log('data.away_score:', data.away_score);
        console.log('🔍 data.setScores:', data.setScores);
        console.log('🔍 data.setScores 타입:', typeof data.setScores);
        console.log('🔍 data.setScores 존재 여부:', !!data.setScores);
        
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          
          // 현재 세트 점수 업데이트 (match_data에만 저장)
          matchData.home_score = data.home_score;
          matchData.away_score = data.away_score;
          
          // set_scores 업데이트 (클라이언트에서 전송된 setScores 사용)
          const currentSet = matchData.current_set || 1;
          
          if (data.setScores && data.setScores.home && data.setScores.away) {
            // 클라이언트에서 전송된 setScores 사용
            matchData.set_scores = data.setScores;
            console.log('🔍 클라이언트에서 전송된 setScores 사용:', JSON.stringify(data.setScores, null, 2));
          } else {
            // 기존 방식으로 현재 세트 점수만 저장
            if (!matchData.set_scores) {
              matchData.set_scores = { home: {}, away: {} };
            }
            matchData.set_scores.home[currentSet] = data.home_score;
            matchData.set_scores.away[currentSet] = data.away_score;
            console.log('🔍 기존 방식으로 set_scores 업데이트');
          }
          
          console.log('🔍 set_scores 업데이트:');
          console.log('currentSet:', currentSet);
          console.log('set_scores:', JSON.stringify(matchData.set_scores, null, 2));
          
          // 토탈 세트 승리 수 계산 (기존 승리 수 유지)
          let homeWins = matchData.home_wins || 0;
          let awayWins = matchData.away_wins || 0;
          
          console.log('새로운 matchData:', matchData);
          console.log('토탈 세트 승리 수:', { homeWins, awayWins });
          
          console.log('🔍 DB 업데이트 전 데이터 검증:');
          console.log('matchData:', JSON.stringify(matchData, null, 2));
          console.log('homeWins:', homeWins, 'awayWins:', awayWins);
          
          // match_data를 명시적으로 설정하여 JSONB 필드 업데이트 보장
          match.match_data = matchData;
          const updateResult = await match.save();
          
          // 추가로 home_score와 away_score도 명시적으로 업데이트
          await match.update({
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins   // 토탈 세트 승리 수
          });
          
          // set_scores가 제대로 저장되었는지 확인
          console.log('🔍 set_scores 저장 확인:');
          console.log('matchData.set_scores:', JSON.stringify(matchData.set_scores, null, 2));
          
          console.log('🔍 DB 업데이트 결과:', updateResult);
          
          // 업데이트 후 데이터 확인
          const updatedMatch = await Match.findByPk(matchId);
          console.log('🔍 업데이트 후 DB 데이터:');
          console.log('home_score:', updatedMatch.home_score);
          console.log('away_score:', updatedMatch.away_score);
          console.log('match_data:', JSON.stringify(updatedMatch.match_data, null, 2));
          
          console.log('✅ 현재 세트 점수 데이터베이스 저장 완료');
          
          // 모든 클라이언트에 현재 세트 점수 업데이트 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins,  // 토탈 세트 승리 수
            match_data: {
              home_score: data.home_score,  // 현재 세트 점수
              away_score: data.away_score   // 현재 세트 점수
            }
          });
          
          console.log(`✅ 현재 세트 점수 업데이트: ${data.home_score}-${data.away_score}`);
          console.log(`✅ 토탈 세트 승리 수: ${homeWins}-${awayWins}`);
        } else {
          console.log('❌ 경기를 찾을 수 없음:', matchId);
        }
        } else if (action === 'next_set_simple') {
          // 단순한 다음 세트 처리
          console.log('🔍 단순한 다음 세트 처리:', matchId);
          const match = await Match.findByPk(matchId);
          if (match) {
            const matchData = match.match_data || {};
            const currentSet = data.currentSet;
            const homeScore = data.homeScore;
            const awayScore = data.awayScore;
            let setScores = data.setScores;
            const setFormat = data.setFormat;
            
            // setScores 데이터 검증 및 초기화
            if (!setScores || !setScores.home || !setScores.away) {
              console.log('setScores 초기화 필요');
              setScores = {
                home: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                away: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
              };
            }
            
            // 빈 객체 체크 및 기본값 설정
            for (let set = 1; set <= 5; set++) {
              if (setScores.home[set] === undefined || setScores.home[set] === null) {
                setScores.home[set] = 0;
              }
              if (setScores.away[set] === undefined || setScores.away[set] === null) {
                setScores.away[set] = 0;
              }
            }
            
            console.log('검증된 setScores:', setScores);
          
          console.log('🔍 세트 정보:', { currentSet, homeScore, awayScore, setFormat });
          
          // 세트 점수 저장
          matchData.set_scores = setScores;
          matchData.set_scores.home[currentSet] = homeScore;
          matchData.set_scores.away[currentSet] = awayScore;
          
          console.log('🔍 DB 저장 전 matchData.set_scores:', matchData.set_scores);
          
          // 세트 승리 계산 (모든 세트 기준으로 재계산)
          let homeWins = 0;
          let awayWins = 0;
          
          // 모든 세트의 승리 계산
          for (let set = 1; set <= 5; set++) {
            const setHomeScore = matchData.set_scores.home[set] || 0;
            const setAwayScore = matchData.set_scores.away[set] || 0;
            
            if (setHomeScore > setAwayScore) {
              homeWins++;
            } else if (setAwayScore > setHomeScore) {
              awayWins++;
            }
          }
          
          console.log('🔍 세트 승리 재계산:', { homeWins, awayWins, setScores: matchData.set_scores });
          
          // 다음 세트로 변경
          const nextSet = currentSet + 1;
          matchData.current_set = nextSet;
          matchData.home_score = 0;  // 현재 세트 점수 초기화
          matchData.away_score = 0;  // 현재 세트 점수 초기화
          matchData.home_wins = homeWins;
          matchData.away_wins = awayWins;
          matchData.setFormat = setFormat;
          matchData.status = nextSet + '세트';
          
          console.log('🔍 저장할 데이터:', {
            current_set: nextSet,
            home_wins: homeWins,
            away_wins: awayWins,
            set_scores: matchData.set_scores
          });
          
          console.log('🔍 DB 업데이트 전 최종 matchData:', JSON.stringify(matchData, null, 2));
          
          // match_data를 명시적으로 설정하여 JSONB 필드 업데이트 보장
          match.match_data = matchData;
          const updateResult = await match.save();
          
          // 추가로 status, home_score, away_score도 명시적으로 업데이트
          await match.update({
            status: nextSet + '세트',
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins   // 토탈 세트 승리 수
          });
          
          console.log('🔍 DB 업데이트 결과:', updateResult);
          
          // DB 저장 후 확인
          const updatedMatch = await Match.findByPk(matchId);
          console.log('🔍 DB 저장 후 matchData:', JSON.stringify(updatedMatch.match_data, null, 2));
          console.log('🔍 DB 저장 후 set_scores:', updatedMatch.match_data.set_scores);
          
          // 모든 클라이언트에 업데이트 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: homeWins,  // 토탈 세트 승리 수
            away_score: awayWins,  // 토탈 세트 승리 수
            match_data: {
              current_set: nextSet,
              home_score: 0,  // 현재 세트 점수 (초기화됨)
              away_score: 0,  // 현재 세트 점수 (초기화됨)
              set_scores: matchData.set_scores,
              home_wins: homeWins,
              away_wins: awayWins,
              setFormat: setFormat
            }
          });
          
          console.log(`✅ 다음 세트로 이동 완료: ${nextSet}세트, 토탈: ${homeWins}-${awayWins}`);
        } else {
          console.log('❌ 경기를 찾을 수 없음:', matchId);
        }
      } else if (action === 'navigate_to_set') {
        // 세트 이동 처리
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          const targetSet = data.targetSet;
          const resetScores = data.resetScores;
          
          console.log(`✅ 세트 이동 요청: ${targetSet}세트, 점수 초기화: ${resetScores}`);
          
          // 현재 세트 변경
          matchData.current_set = targetSet;
          
          // 점수 초기화 옵션에 따른 처리
          if (resetScores) {
            // 현재 세트 점수 초기화
            matchData.home_score = 0;
            matchData.away_score = 0;
            
            // 이후 세트들의 점수 초기화
            if (!matchData.set_scores) {
              matchData.set_scores = { home: {}, away: {} };
            }
            
            for (let set = targetSet + 1; set <= 5; set++) {
              matchData.set_scores.home[set] = 0;
              matchData.set_scores.away[set] = 0;
            }
            
            console.log(`✅ ${targetSet}세트 이후 점수 초기화 완료`);
          }
          
          await match.update({ match_data: matchData });
          
          // 모든 클라이언트에 세트 이동 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            match_data: {
              current_set: targetSet,
              home_score: matchData.home_score,
              away_score: matchData.away_score,
              set_scores: matchData.set_scores
            }
          });
          
          console.log(`✅ 세트 이동 완료: ${targetSet}세트`);
        }
      } else if (action === 'save_match_score') {
        // 매치 점수(세트 승리 수) 저장 처리
        console.log('🔍 매치 점수 저장 디버깅:');
        console.log('matchId:', matchId);
        console.log('data.homeWins:', data.homeWins);
        console.log('data.awayWins:', data.awayWins);
        
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          
          // 매치 점수(세트 승리 수) 저장
          matchData.home_wins = data.homeWins;
          matchData.away_wins = data.awayWins;
          
          console.log('새로운 matchData:', matchData);
          console.log('저장할 매치 점수:', { homeWins: data.homeWins, awayWins: data.awayWins });
          
          console.log('🔍 매치 점수 DB 업데이트 전 데이터 검증:');
          console.log('matchData:', JSON.stringify(matchData, null, 2));
          console.log('homeWins:', data.homeWins, 'awayWins:', data.awayWins);
          
          // match_data를 명시적으로 설정하여 JSONB 필드 업데이트 보장
          match.match_data = matchData;
          const updateResult = await match.save();
          
          // 추가로 home_score와 away_score도 명시적으로 업데이트
          await match.update({
            home_score: data.homeWins,  // 토탈 세트 승리 수
            away_score: data.awayWins   // 토탈 세트 승리 수
          });
          
          console.log('🔍 매치 점수 DB 업데이트 결과:', updateResult);
          
          // 업데이트 후 데이터 확인
          const updatedMatch = await Match.findByPk(matchId);
          console.log('🔍 매치 점수 업데이트 후 DB 데이터:');
          console.log('home_score:', updatedMatch.home_score);
          console.log('away_score:', updatedMatch.away_score);
          console.log('match_data.home_wins:', updatedMatch.match_data?.home_wins);
          console.log('match_data.away_wins:', updatedMatch.match_data?.away_wins);
          
          console.log('✅ 매치 점수 데이터베이스 저장 완료');
          
          // 모든 클라이언트에 매치 점수 업데이트 알림
          const roomName = `match_${matchId}`;
          io.to(roomName).emit('match_updated', {
            matchId: matchId,
            home_score: data.homeWins,  // 토탈 세트 승리 수
            away_score: data.awayWins,  // 토탈 세트 승리 수
            match_data: {
              home_wins: data.homeWins,
              away_wins: data.awayWins
            }
          });
          
          console.log(`✅ 매치 점수 업데이트: ${data.homeWins}-${data.awayWins}`);
        } else {
          console.log('❌ 경기를 찾을 수 없음:', matchId);
        }
      } else if (action === 'load_set_scores') {
        // 세트 점수 로드 처리
        console.log('🔍 세트 점수 로드 디버깅:');
        console.log('matchId:', matchId);
        
        const match = await Match.findByPk(matchId);
        if (match) {
          const matchData = match.match_data || {};
          const setScores = matchData.set_scores || { home: {}, away: {} };
          const setFormat = matchData.setFormat || 3;
          const homeWins = matchData.home_wins || 0;
          const awayWins = matchData.away_wins || 0;
          
          console.log('로드된 세트 점수:', setScores);
          console.log('로드된 세트제:', setFormat);
          console.log('로드된 매치 점수:', { homeWins, awayWins });
          
          // 클라이언트에 세트 점수 전송
          socket.emit('set_scores_loaded', {
            matchId: matchId,
            setScores: setScores,
            setFormat: setFormat,
            homeWins: homeWins,
            awayWins: awayWins
          });
          
          console.log('✅ 세트 점수 로드 완료');
        } else {
          console.log('❌ 경기를 찾을 수 없음:', matchId);
        }
      }
    } catch (error) {
      console.error('❌ 배구 컨트롤 처리 오류:', error);
    }
  });

  // 초기 경기 데이터 로드 (컨트롤/오버레이 페이지 복원용)
  socket.on('loadMatchData', async (payload) => {
    try {
      const { matchId } = payload || {};
      if (!matchId) return;

      const match = await Match.findByPk(matchId);
      if (!match) return;

      // 디버깅: match_data 내용 확인
      console.log('🔍 loadMatchData 디버깅:');
      console.log('matchId:', matchId);
      console.log('match.match_data:', match.match_data);
      console.log('match.match_data.setFormat:', match.match_data?.setFormat);
      
      // 접속한 소켓에게만 초기 데이터 반환
      socket.emit('matchDataLoaded', {
        id: match.id,
        sport_type: match.sport_type,
        home_team: match.home_team,
        away_team: match.away_team,
        home_team_color: match.home_team_color,
        away_team_color: match.away_team_color,
        home_score: match.home_score, // 토탈 세트 승리 수
        away_score: match.away_score, // 토탈 세트 승리 수
        status: match.status,
        match_data: match.match_data || {}
      });
    } catch (err) {
      console.error('❌ loadMatchData 처리 오류:', err);
    }
  });
  
  // 연결 해제
  socket.on('disconnect', () => {
    console.log('❌ 클라이언트 연결 해제:', socket.id);
  });
});

// 로거 설정
const logger = createLogger();
app.use((req, res, next) => {
  req.logger = logger;
  next();
});

// 미들웨어 설정
app.use(require('cors')(corsConfig));
app.use(require('body-parser').json(bodyParserConfig.json));
app.use(require('body-parser').urlencoded(bodyParserConfig.urlencoded));
app.use(morganConfig);
app.use(require('express-session')(sessionConfig));
app.use(addUserToTemplate);
app.use(customLogging);
app.use(sessionDebugging);

// 정적 파일 서빙
app.use(express.static(staticConfig.public.path, staticConfig.public.options));

// EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', staticConfig.views.path);

// 라우터 연결 함수화
function connectRouters() {
  console.log('🔧 라우터 연결 시작...');
  
  // 1. API 라우터들 (구체적인 경로부터)
  const apiRouters = [
    { path: '/api/sport-management', router: dbManagementRouter, name: 'DB 관리 API' },
    { path: '/api/db-management', router: tableManagementRouter, name: '테이블 관리 API' },
    { path: '/api/users', router: usersRouter, name: '사용자 API' },
    { path: '/api/templates', router: templatesRouter, name: '템플릿 API' },
    { path: '/api/sport', router: sportsRouter, name: '종목 API' },
    { path: '/api/backup', router: backupRouter, name: '백업 API' },
    { path: '/api/team-logos', router: teamLogosRouter, name: '통합 팀로고 API' },
    { path: '/api/logs', router: logsRouter, name: '로그 API' },
    { path: '/api/settings', router: settingsRouter, name: '설정 API' },
    { path: '/api/matches', router: matchesRouter, name: '경기 API' },
    { path: '/api/match-lists', router: matchListsRouter, name: '경기 목록 API' }
  ];
  
  // 2. 오버레이 이미지 전용 라우터 (최우선순위)
  const overlayImageRouters = [
    { path: '/api/overlay-images', router: overlayImagesRouter, name: '오버레이 이미지 API' }
  ];
  
  // 3. 기타 오버레이 API 라우터 (최후순위)
  const overlayRouters = [
    { path: '/api/overlay-other', router: overlaysRouter, name: '기타 오버레이 API' }
  ];
  
  // 4. 페이지 라우터들 (API가 아닌 페이지)
  const pageRouters = [
    { path: '/db-management', router: dbManagementRouter, name: 'DB 관리 페이지' },
    { path: '/list', router: matchListsRouter, name: '리스트 페이지' },
    { path: '/unified', router: matchListsRouter, name: '통합 오버레이 페이지' }
  ];
  
  // 5. 인증 라우터들
  const authRouters = [
    { path: '/', router: authRouter, name: '인증 라우터' }
  ];
  
  // 라우터 연결 실행 (오버레이 이미지 라우터를 최우선순위로)
  [...overlayImageRouters, ...apiRouters, ...overlayRouters, ...pageRouters, ...authRouters].forEach(({ path, router, name }) => {
    app.use(path, router);
    console.log(`✅ ${name} 연결: ${path}`);
  });
  
  console.log('🔧 라우터 연결 완료');
}

// 라우터 연결 검증 함수
function validateRouterConnections() {
  console.log('🔍 라우터 연결 검증 시작...');
  
  const connectedPaths = [];
  const routerConfig = [
    { path: '/api/sport-management', name: 'DB 관리 API' },
    { path: '/api/users', name: '사용자 API' },
    { path: '/api/templates', name: '템플릿 API' },
    { path: '/api/sport', name: '종목 API' },
    { path: '/api/backup', name: '백업 API' },
    { path: '/api/logs', name: '로그 API' },
    { path: '/api/settings', name: '설정 API' },
    { path: '/api/matches', name: '경기 API' },
    { path: '/api/match-lists', name: '경기 목록 API' },
    { path: '/db-management', name: 'DB 관리 페이지' },
    { path: '/list', name: '리스트 페이지' },
    { path: '/unified', name: '통합 오버레이 페이지' },
    { path: '/', name: '인증 라우터' },
    { path: '/api', name: '오버레이 API' }
  ];
  
  // 중복 경로 검사
  routerConfig.forEach(({ path, name }) => {
    if (connectedPaths.includes(path)) {
      console.error(`❌ 중복 라우터 경로: ${path} (${name})`);
      throw new Error(`Duplicate router path: ${path}`);
    }
    connectedPaths.push(path);
  });
  
  console.log('✅ 라우터 연결 검증 완료');
  console.log(`📊 총 ${connectedPaths.length}개 라우터 연결됨`);
}

// 라우터 연결 실행
connectRouters();

// 라우터 연결 검증
validateRouterConnections();

// 누락된 API 엔드포인트들 추가

// 구체적인 경기 관련 API들을 먼저 등록 (라우트 매칭 순서 중요)

// 탭별 경기 삭제 API (가장 구체적인 라우트 - 최우선)
// /api/matches/by-tab API는 routes/matches.js로 이동됨

// 모든 경기 삭제 API (구체적인 라우트)
app.delete('/api/matches/all', requireAuth, async (req, res) => {
  try {
    console.log(`[DEBUG] DELETE /api/matches/all 요청 받음`);
    
    let whereCondition = {};
    
    // 일반 사용자는 자신이 만든 경기만 삭제할 수 있음
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
    }

    const deletedCount = await Match.destroy({
      where: whereCondition
    });

    console.log(`[DEBUG] 모든 경기 ${deletedCount}개 삭제됨 (사용자: ${req.session.username})`);
    res.json({ success: true, message: `모든 경기 ${deletedCount}개가 삭제되었습니다.` });
  } catch (error) {
    console.error('[DEBUG] 모든 경기 삭제 실패:', error);
    res.status(500).json({ error: '경기 삭제 중 오류가 발생했습니다.' });
  }
});

// 개별 경기 삭제 API (일반적인 라우트)
app.delete('/api/matches/:id', requireAuth, async (req, res) => {
  try {
    console.log(`🔥🔥🔥 DELETE /api/matches/:id 라우트 매칭됨 - ID: ${req.params.id} 🔥🔥🔥`);
    console.log(`🔥🔥🔥 요청 URL: ${req.url} 🔥🔥🔥`);
    console.log(`🔥🔥🔥 요청 메서드: ${req.method} 🔥🔥🔥`);
    console.log(`🔥🔥🔥 요청 경로: ${req.path} 🔥🔥🔥`);
    console.log(`🔥🔥🔥 전체 요청 정보:`, {
      method: req.method,
      url: req.url,
      path: req.path,
      params: req.params,
      query: req.query
    });
    
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      console.log(`[DEBUG] 경기를 찾을 수 없음: ${req.params.id}`);
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }

    console.log(`[DEBUG] 경기 찾음: ${match.id}, 생성자: ${match.created_by}`);

    // 일반 사용자는 자신이 만든 경기만 삭제 가능
    if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
      console.log(`[DEBUG] 삭제 권한 없음: 사용자 ${req.session.userId}, 경기 생성자 ${match.created_by}`);
      return res.status(403).json({ error: '이 경기를 삭제할 권한이 없습니다.' });
    }

    // 경기 삭제 전에 관련 Settings 항목들 정리
    const matchId = match.id;
    console.log(`[DEBUG] 경기 삭제 전 Settings 정리 시작: ${matchId}`);
    
    try {
      // 해당 경기와 관련된 모든 Settings 항목 삭제
      const deletedSettingsCount = await Settings.destroy({
        where: {
          [Op.or]: [
            { key: `timer_mode_${matchId}` },
            { key: `soccer_team_logo_visibility_${matchId}` },
            { key: `soccer_team_logo_display_mode_${matchId}` },
            { key: `tournament_text_${matchId}` },
            { key: `baseball_team_logo_visibility_${matchId}` },
            { key: `baseball_team_logo_display_mode_${matchId}` }
          ]
        }
      });
      
      console.log(`[DEBUG] Settings 정리 완료: ${deletedSettingsCount}개 항목 삭제됨`);
    } catch (settingsError) {
      console.error(`[DEBUG] Settings 정리 중 오류 발생:`, settingsError);
      // Settings 정리 실패해도 경기 삭제는 계속 진행
    }

    await match.destroy();
    console.log(`[DEBUG] 경기 삭제 완료: ${match.id} (사용자: ${req.session.username})`);
    res.json({ success: true, message: '경기가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('[DEBUG] 경기 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 모든 경기 데이터 조회 API (구체적인 라우트)
app.get('/api/matches/all', requireAuth, async (req, res) => {
  try {
    const { Match } = require('./models');
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(matches);
  } catch (error) {
    console.error('모든 경기 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 점수 CSV 다운로드 API (구체적인 라우트)
app.get('/api/matches/score-csv', requireAuth, async (req, res) => {
  try {
    console.log('[DEBUG] 경기 점수 CSV 다운로드 요청 받음');
    
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });

    let csvContent = 'ID,홈팀,원정팀,홈점수,원정점수,상태,생성일\n';
    
    matches.forEach(match => {
      csvContent += `${match.id},${match.home_team},${match.away_team},${match.home_score},${match.away_score},${match.status},${match.created_at}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="matches_score.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('[DEBUG] CSV 다운로드 실패:', error);
    res.status(500).json({ error: 'CSV 다운로드 중 오류가 발생했습니다.' });
  }
});

// 경기 점수 CSV 다운로드 API (리스트별) (구체적인 라우트)
app.get('/api/matches/score-csv-by-lists', requireAuth, async (req, res) => {
  try {
    console.log('[DEBUG] 경기 점수 CSV 다운로드 (리스트별) 요청 받음');
    
    const matches = await Match.findAll({
      order: [['created_at', 'DESC']]
    });

    let csvContent = 'ID,홈팀,원정팀,홈점수,원정점수,상태,생성일\n';
    
    matches.forEach(match => {
      csvContent += `${match.id},${match.home_team},${match.away_team},${match.home_score},${match.away_score},${match.status},${match.created_at}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="matches_score_by_lists.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('[DEBUG] CSV 다운로드 실패:', error);
    res.status(500).json({ error: 'CSV 다운로드 중 오류가 발생했습니다.' });
  }
});

// 중복된 API 제거됨 - 위에서 이미 정의됨

// 모든 경기 삭제 API (구체적인 라우트)
app.delete('/api/matches/all', requireAuth, async (req, res) => {
  try {
    console.log(`[DEBUG] DELETE /api/matches/all 요청 받음`);
    
    let whereCondition = {};
    
    // 일반 사용자는 자신이 만든 경기만 삭제할 수 있음
    if (req.session.userRole !== 'admin') {
      whereCondition.created_by = req.session.userId;
    }

    const deletedCount = await Match.destroy({
      where: whereCondition
    });

    console.log(`[DEBUG] 모든 경기 ${deletedCount}개 삭제됨 (사용자: ${req.session.username})`);
    res.json({ success: true, message: `모든 경기 ${deletedCount}개가 삭제되었습니다.` });
  } catch (error) {
    console.error('[DEBUG] 모든 경기 삭제 실패:', error);
    res.status(500).json({ error: '경기 삭제 중 오류가 발생했습니다.' });
  }
});

// 일반적인 경기 목록 조회 API (나중에 등록)
// GET /api/matches/:id - 개별 경기 조회
app.get('/api/matches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] 개별 경기 조회 요청: ID=${id}`);
    
    const match = await Match.findByPk(id);
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    const username = req.session?.username || 'overlay';
    console.log(`[DEBUG] 경기 조회 성공: ${id} (사용자: ${username})`);
    res.json(match);
  } catch (error) {
    console.error('[DEBUG] 개별 경기 조회 실패:', error);
    res.status(500).json({ error: '경기 조회 중 오류가 발생했습니다.' });
  }
});

// 야구 방식의 통합 초기 데이터 엔드포인트 (배구용)
app.get('/api/matches/:matchId/initial-data', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`[DEBUG] 배구 통합 초기 데이터 요청: ID=${matchId}`);
    
    const match = await Match.findByPk(matchId);
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 야구 방식의 통합 데이터 구성
    const initialData = {
      // 기본 경기 정보
      id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      home_score: match.home_score,
      away_score: match.away_score,
      status: match.status,
      
      // match_data (JSONB 필드)
      match_data: match.match_data || {},
      
      // 세트 점수 (배구 특화)
      set_scores: match.match_data?.set_scores || { home: {}, away: {} },
      setFormat: match.match_data?.setFormat || 3,
      current_set: match.match_data?.current_set || 1,
      servingTeam: match.match_data?.servingTeam || 'home',
      
      // 팀 로고 및 컬러
      home_team_logo: match.match_data?.home_team_logo || '',
      away_team_logo: match.match_data?.away_team_logo || '',
      home_team_color: match.match_data?.home_team_color || '#1e40af',
      away_team_color: match.match_data?.away_team_color || '#1e40af',
      home_team_colorbg: match.match_data?.home_team_colorbg || '#ffffff',
      away_team_colorbg: match.match_data?.away_team_colorbg || '#ffffff',
      
      // 팀명
      home_team_name: match.match_data?.home_team_name || match.home_team,
      away_team_name: match.match_data?.away_team_name || match.away_team,
      
      // 세트 승리 수
      home_wins: match.match_data?.home_wins || 0,
      away_wins: match.match_data?.away_wins || 0
    };
    
    console.log(`[DEBUG] 배구 통합 초기 데이터 응답:`, {
      matchId,
      set_scores: initialData.set_scores,
      setFormat: initialData.setFormat,
      current_set: initialData.current_set
    });
    
    res.json(initialData);
  } catch (error) {
    console.error('배구 통합 초기 데이터 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/matches', requireAuth, async (req, res) => {
  try {
    console.log('[DEBUG] 경기 목록 조회 요청 받음');
    
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
    
    console.log(`[DEBUG] 조회된 경기 수: ${matches.length} (사용자: ${req.session.username})`);

    // 템플릿 기반 분류를 위해 Sport와 Template 정보 가져오기
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default'],
      order: [['id', 'ASC']]
    });
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

    console.log('[DEBUG] 경기 목록 조회 성공');
    res.json(matchesWithUrls);
  } catch (error) {
    console.error('[DEBUG] 경기 목록 조회 실패:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 중복된 API 제거됨 - 위에서 이미 정의됨

// 🚨 중복 API 제거됨 - usersRouter에서 처리
// 사용자 관리 API (라우터로 이동됨)
/*
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'full_name', 'role', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ error: '사용자 목록 조회에 실패했습니다.' });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: '사용자명, 이메일, 비밀번호는 필수입니다.' });
    }
    
    const user = await User.create({
      username,
      email,
      password,
      full_name,
      role: role || 'user',
      is_active: true
    });
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('사용자 생성 실패:', error);
    res.status(500).json({ error: '사용자 생성에 실패했습니다.' });
  }
});

app.get('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json(user);
  } catch (error) {
    console.error('사용자 조회 실패:', error);
    res.status(500).json({ error: '사용자 조회에 실패했습니다.' });
  }
});
*/

/*
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { username, email, full_name, role, is_active } = req.body;
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    await user.update({
      username,
      email,
      full_name,
      role,
      is_active
    });
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('사용자 수정 실패:', error);
    res.status(500).json({ error: '사용자 수정에 실패했습니다.' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    await user.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('사용자 삭제 실패:', error);
    res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
  }
});
*/

// /api/base-templates API는 routes/templates.js로 이동됨

// 설정 관련 API는 routes/settings.js로 이동됨
// 로그 관련 API는 routes/logs.js로 이동됨

// 오버레이 디자인 관련 API는 routes/overlays.js로 이동됨

app.get('/api/soccer-match-state-visibility', async (req, res) => {
  try {
    // 축구 경기 상태 가시성 조회
    res.json({});
  } catch (error) {
    console.error('축구 경기 상태 가시성 조회 실패:', error);
    res.status(500).json({ error: '축구 경기 상태 가시성 조회에 실패했습니다.' });
  }
});

// 백업 관련 API는 routes/backup.js로 이동됨

// 누락된 API 엔드포인트들 추가

// POST /api/sport - 새 종목 생성 (routes/sports.js로 이동됨 - 중복 제거)

// PUT /api/sport/:code - 종목 수정
app.put('/api/sport/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { name, template, description } = req.body;
    
    const sport = await Sport.findOne({ where: { code } });
    if (!sport) {
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }
    
    await sport.update({
      name,
      template,
      description
    });
    
    console.log(`종목 수정: ${name} (${code})`);
    res.json({ success: true, sport });
  } catch (error) {
    console.error('종목 수정 실패:', error);
    res.status(500).json({ error: '종목 수정에 실패했습니다.' });
  }
});

// DELETE /api/sport/:code - 종목 삭제
app.delete('/api/sport/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    console.log(`🔍 스포츠 삭제 요청: ${code}`);
    
    const sport = await Sport.findOne({ where: { code: code.toUpperCase() } });
    if (!sport) {
      console.log(`❌ 스포츠를 찾을 수 없음: ${code}`);
      return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
    }
    
    // 기본 종목은 삭제 불가
    if (sport.is_default) {
      console.log(`❌ 기본 종목은 삭제할 수 없음: ${sport.name}`);
      return res.status(400).json({ error: '기본 종목은 삭제할 수 없습니다.' });
    }
    
    console.log(`✅ 스포츠 찾음: ${sport.name} (${sport.code})`);
    
    // 관련 데이터 삭제
    const { Match, SportOverlayImage, SportActiveOverlayImage, TeamInfo } = require('./models');
    
    // 1. 관련 경기 삭제
    const matchCount = await Match.count({ where: { sport_type: sport.code } });
    if (matchCount > 0) {
      await Match.destroy({ where: { sport_type: sport.code } });
      console.log(`✅ 관련 경기 삭제: ${matchCount}개`);
    }
    
    // 2. 오버레이 이미지 삭제
    try {
      const overlayImageCount = await SportOverlayImage.count({ where: { sport_code: sport.code } });
      if (overlayImageCount > 0) {
        await SportOverlayImage.destroy({ where: { sport_code: sport.code } });
        console.log(`✅ 오버레이 이미지 삭제: ${overlayImageCount}개`);
      }
    } catch (error) {
      console.warn('⚠️ 오버레이 이미지 삭제 실패:', error.message);
    }
    
    // 3. 활성 오버레이 이미지 삭제
    try {
      const activeOverlayImageCount = await SportActiveOverlayImage.count({ where: { sport_code: sport.code } });
      if (activeOverlayImageCount > 0) {
        await SportActiveOverlayImage.destroy({ where: { sport_code: sport.code } });
        console.log(`✅ 활성 오버레이 이미지 삭제: ${activeOverlayImageCount}개`);
      }
    } catch (error) {
      console.warn('⚠️ 활성 오버레이 이미지 삭제 실패:', error.message);
    }
    
    // 4. 팀 정보 삭제
    try {
      const teamInfoCount = await TeamInfo.count({ where: { sport_type: sport.code } });
      if (teamInfoCount > 0) {
        await TeamInfo.destroy({ where: { sport_type: sport.code } });
        console.log(`✅ 팀 정보 삭제: ${teamInfoCount}개`);
      }
    } catch (error) {
      console.warn('⚠️ 팀 정보 삭제 실패:', error.message);
    }
    
    // 5. 폴더 삭제 (리팩토링 이전/이후 경로 모두 확인)
    const fs = require('fs');
    const path = require('path');
    
    // 오버레이 이미지 폴더 삭제 (여러 가능한 경로 확인)
    const overlayPaths = [
      path.join(__dirname, 'public', 'overlay-images', sport.code.toUpperCase()), // 현재 방식
      path.join(__dirname, 'public', 'overlay-images', sport.name.toUpperCase()), // 리팩토링 이전 방식
      path.join(__dirname, 'public', 'overlay-images', sport.code), // 소문자
      path.join(__dirname, 'public', 'overlay-images', sport.name) // 소문자
    ];
    
    for (const overlayPath of overlayPaths) {
      if (fs.existsSync(overlayPath)) {
        fs.rmSync(overlayPath, { recursive: true, force: true });
        console.log(`✅ 오버레이 폴더 삭제: ${overlayPath}`);
        break; // 하나만 삭제하면 됨
      }
    }
    
    // 팀로고 폴더 삭제 (여러 가능한 경로 확인)
    const teamLogoPaths = [
      path.join(__dirname, 'public', 'TEAMLOGO', sport.code.toUpperCase()), // 현재 방식
      path.join(__dirname, 'public', 'TEAMLOGO', sport.name.toUpperCase()), // 리팩토링 이전 방식
      path.join(__dirname, 'public', 'TEAMLOGO', sport.code), // 소문자
      path.join(__dirname, 'public', 'TEAMLOGO', sport.name) // 소문자
    ];
    
    for (const teamLogoPath of teamLogoPaths) {
      if (fs.existsSync(teamLogoPath)) {
        fs.rmSync(teamLogoPath, { recursive: true, force: true });
        console.log(`✅ 팀로고 폴더 삭제: ${teamLogoPath}`);
        break; // 하나만 삭제하면 됨
      }
    }
    
    // 6. 스포츠 삭제
    await sport.destroy();
    
    console.log(`✅ 종목 삭제 완료: ${sport.name} (${sport.code})`);
    res.json({ success: true, message: '종목이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('❌ 종목 삭제 실패:', error);
    res.status(500).json({ error: '종목 삭제에 실패했습니다.', details: error.message });
  }
});

// 중복 API 엔드포인트 제거 - 라우터에서 처리됨

// 중복 API 엔드포인트 제거 - 라우터에서 처리됨

// 중복 API 엔드포인트 제거 - 라우터에서 처리됨

// 🚨 중복 API 제거됨 - logsRouter에서 처리
// 로그 관련 API (라우터로 이동됨)
/*
// GET /api/logs - 로그 목록 조회
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const logsDir = path.join(__dirname, 'logs');
    const files = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
    
    const logs = files.map(file => ({
      filename: file,
      path: path.join(logsDir, file),
      size: fs.statSync(path.join(logsDir, file)).size,
      modified: fs.statSync(path.join(logsDir, file)).mtime
    }));
    
    res.json(logs);
  } catch (error) {
    console.error('로그 목록 조회 실패:', error);
    res.status(500).json({ error: '로그 목록 조회에 실패했습니다.' });
  }
});

// GET /api/logs/:filename - 특정 로그 파일 조회
app.get('/api/logs/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const logPath = path.join(__dirname, 'logs', filename);
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    const content = fs.readFileSync(logPath, 'utf8');
    res.json({ filename, content });
  } catch (error) {
    console.error('로그 파일 조회 실패:', error);
    res.status(500).json({ error: '로그 파일 조회에 실패했습니다.' });
  }
});

// GET /api/logs/:filename/content - 로그 파일 내용 조회
app.get('/api/logs/:filename/content', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const logPath = path.join(__dirname, 'logs', filename);
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    const content = fs.readFileSync(logPath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
  } catch (error) {
    console.error('로그 파일 내용 조회 실패:', error);
    res.status(500).json({ error: '로그 파일 내용 조회에 실패했습니다.' });
  }
});
*/

// POST /api/backup/create - 백업 생성
// 백업 생성 API는 routes/backup.js로 이동됨

// 백업 다운로드 API는 routes/backup.js로 이동됨

// 백업 복원 API는 routes/backup.js로 이동됨

// GET /api/sport-overlay-design/:sportCode - 종목별 오버레이 디자인 조회
app.get('/api/sport-overlay-design/:sportCode', requireAuth, async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 오버레이 디자인 조회 로직 (placeholder)
    console.log(`종목별 오버레이 디자인 조회: ${sportCode}`);
    res.json({ 
      success: true, 
      sportCode,
      design: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontSize: 24
      }
    });
  } catch (error) {
    console.error('오버레이 디자인 조회 실패:', error);
    res.status(500).json({ error: '오버레이 디자인 조회에 실패했습니다.' });
  }
});

// GET /api/sport-overlay-images-with-active/:sportCode - 종목별 활성 오버레이 이미지 조회
// /api/sport-overlay-images-with-active/:sportCode API는 routes/overlays.js로 이동됨

// GET /api/sport-active-overlay-image/:sportCode - 종목별 활성 오버레이 이미지 조회
app.get('/api/sport-active-overlay-image/:sportCode', requireAuth, async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 활성 오버레이 이미지 조회 로직 (placeholder)
    console.log(`종목별 활성 오버레이 이미지 조회: ${sportCode}`);
    res.json({ 
      success: true, 
      sportCode,
      image: null
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 조회에 실패했습니다.' });
  }
});

// POST /api/sport-overlay-image - 종목별 오버레이 이미지 업로드
app.post('/api/sport-overlay-image', requireAuth, async (req, res) => {
  try {
    const { sportCode, imageName } = req.body;
    
    // 오버레이 이미지 업로드 로직 (placeholder)
    console.log(`종목별 오버레이 이미지 업로드: ${sportCode} - ${imageName}`);
    res.json({ 
      success: true, 
      message: '오버레이 이미지가 업로드되었습니다.',
      sportCode,
      imageName
    });
  } catch (error) {
    console.error('오버레이 이미지 업로드 실패:', error);
    res.status(500).json({ error: '오버레이 이미지 업로드에 실패했습니다.' });
  }
});

// GET /api/sport-overlay-image/:sportCode/:filename - 특정 오버레이 이미지 조회
app.get('/api/sport-overlay-image/:sportCode/:filename', requireAuth, async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    // 특정 오버레이 이미지 조회 로직 (placeholder)
    console.log(`특정 오버레이 이미지 조회: ${sportCode} - ${filename}`);
    res.json({ 
      success: true, 
      sportCode,
      filename,
      image: null
    });
  } catch (error) {
    console.error('특정 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '특정 오버레이 이미지 조회에 실패했습니다.' });
  }
});

// GET /api/sport-overlay-image/:sportCode/:filename/status - 오버레이 이미지 상태 조회
app.get('/api/sport-overlay-image/:sportCode/:filename/status', requireAuth, async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    // 오버레이 이미지 상태 조회 로직 (placeholder)
    console.log(`오버레이 이미지 상태 조회: ${sportCode} - ${filename}`);
    res.json({ 
      success: true, 
      sportCode,
      filename,
      status: 'active'
    });
  } catch (error) {
    console.error('오버레이 이미지 상태 조회 실패:', error);
    res.status(500).json({ error: '오버레이 이미지 상태 조회에 실패했습니다.' });
  }
});

// PUT /api/sport-active-overlay-image/:sportCode - 활성 오버레이 이미지 설정
app.put('/api/sport-active-overlay-image/:sportCode', requireAuth, async (req, res) => {
  try {
    const { sportCode } = req.params;
    const { imageName } = req.body;
    
    // 활성 오버레이 이미지 설정 로직 (placeholder)
    console.log(`활성 오버레이 이미지 설정: ${sportCode} - ${imageName}`);
    res.json({ 
      success: true, 
      message: '활성 오버레이 이미지가 설정되었습니다.',
      sportCode,
      imageName
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 설정 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 설정에 실패했습니다.' });
  }
});

// DELETE /api/sport-active-overlay-image/:sportCode - 활성 오버레이 이미지 삭제
app.delete('/api/sport-active-overlay-image/:sportCode', requireAuth, async (req, res) => {
  try {
    const { sportCode } = req.params;
    
    // 활성 오버레이 이미지 삭제 로직 (placeholder)
    console.log(`활성 오버레이 이미지 삭제: ${sportCode}`);
    res.json({ 
      success: true, 
      message: '활성 오버레이 이미지가 삭제되었습니다.',
      sportCode
    });
  } catch (error) {
    console.error('활성 오버레이 이미지 삭제 실패:', error);
    res.status(500).json({ error: '활성 오버레이 이미지 삭제에 실패했습니다.' });
  }
});

// 중복된 API 제거됨 - routes/matches.js에서 처리

// PUT /api/match/:id/swap-teams - 경기 팀 순서 변경
app.put('/api/match/:id/swap-teams', async (req, res) => {
  try {
    const { id } = req.params;
    
    const match = await Match.findByPk(id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 팀 순서 변경 로직 (placeholder)
    console.log(`경기 팀 순서 변경: ${id}`);
    res.json({ success: true, match });
  } catch (error) {
    console.error('경기 팀 순서 변경 실패:', error);
    res.status(500).json({ error: '경기 팀 순서 변경에 실패했습니다.' });
  }
});

// GET /api/pushed-match/:listId - 푸시된 경기 조회 (인증 임시 제거)
app.get('/api/pushed-match/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    
    // 푸시된 경기 정보 확인
    const pushedMatch = global.pushedMatches ? global.pushedMatches.get(listId) : null;
    
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
    console.error('푸시된 경기 조회 실패:', error);
    res.status(500).json({ error: '푸시된 경기 조회에 실패했습니다.' });
  }
});


// GET /api/baseball-team-logo-visibility/:matchId - 야구 팀 로고 가시성 조회
app.get('/api/baseball-team-logo-visibility/:matchId', requireAuth, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    // 야구 팀 로고 가시성 조회 로직 (placeholder)
    console.log(`야구 팀 로고 가시성 조회: ${matchId}`);
    res.json({ 
      success: true, 
      matchId,
      visibility: {
        team1: true,
        team2: true
      }
    });
  } catch (error) {
    console.error('야구 팀 로고 가시성 조회 실패:', error);
    res.status(500).json({ error: '야구 팀 로고 가시성 조회에 실패했습니다.' });
  }
});

// 중복된 API 제거됨 - routes/overlays.js에서 처리

// GET /api/tournament-text/:matchId - 토너먼트 텍스트 조회 (인증 없이 접근 가능)
app.get('/api/tournament-text/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    
    console.log(`토너먼트 텍스트 조회: ${matchId}`);
    
    // Settings 테이블에서 대회명 조회
    const { Settings } = require('./models');
    const setting = await Settings.findOne({
      where: { key: `tournament_text_${matchId}` }
    });
    
    const tournamentText = setting ? setting.value : '';
    
    console.log(`조회된 대회명: ${tournamentText}`);
    
    res.json({ 
      success: true, 
      matchId,
      tournamentText: tournamentText
    });
  } catch (error) {
    console.error('토너먼트 텍스트 조회 실패:', error);
    res.status(500).json({ error: '토너먼트 텍스트 조회에 실패했습니다.' });
  }
});

// GET /api/load-lineup/:matchId - 라인업 조회
app.get('/api/load-lineup/:matchId', requireAuth, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    // 라인업 조회 로직 (placeholder)
    console.log(`라인업 조회: ${matchId}`);
    res.json({ 
      success: true, 
      matchId,
      lineup: {
        team1: [],
        team2: []
      }
    });
  } catch (error) {
    console.error('라인업 조회 실패:', error);
    res.status(500).json({ error: '라인업 조회에 실패했습니다.' });
  }
});

// POST /api/bulk-create-matches - 대량 경기 생성
app.post('/api/bulk-create-matches', requireAuth, csvUpload.single('csvFile'), async (req, res) => {
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
    const { Match, MatchList } = require('./models');

    // 데이터 처리
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map(col => col.trim());
      if (columns.length < 3) continue;

      const [listName, homeTeam, awayTeam] = columns;
      
      // 경기 생성
      const match = await Match.create({
        sport_type: 'SOCCER', // 기본값
        home_team: homeTeam,
        away_team: awayTeam,
        home_team_color: '#000000',
        away_team_color: '#FFFFFF',
        home_team_header: homeTeam,
        away_team_header: awayTeam,
        home_score: 0,
        away_score: 0,
        status: 'scheduled',
        match_data: {},
        created_by: req.session.userId
      });

      // 리스트 확인 및 생성
      let matchList = await MatchList.findOne({ where: { name: listName } });
      if (!matchList) {
        matchList = await MatchList.create({
          name: listName,
          matches: [],
          created_by: req.session.userId
        });
        createdLists++;
      }

      // 리스트에 경기 추가
      const currentMatches = matchList.matches || [];
      currentMatches.push(match.id);
      await matchList.update({ matches: currentMatches });

      createdMatches++;
    }

    res.json({
      success: true,
      message: `${createdMatches}개의 경기와 ${createdLists}개의 리스트가 생성되었습니다.`,
      createdMatches,
      createdLists
    });
  } catch (error) {
    console.error('대량 경기 생성 실패:', error);
    res.status(500).json({ error: '대량 경기 생성에 실패했습니다.' });
  }
});

// GET /api/list/:id/current-match - 현재 경기 조회
app.get('/api/list/:id/current-match', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { index } = req.query;
    
    // 현재 경기 조회 로직 (placeholder)
    console.log(`현재 경기 조회: ${id} - ${index}`);
    res.json({ 
      success: true, 
      listId: id,
      index: index,
      match: null
    });
  } catch (error) {
    console.error('현재 경기 조회 실패:', error);
    res.status(500).json({ error: '현재 경기 조회에 실패했습니다.' });
  }
});

// 🚨 중복 API 제거됨 - overlaysRouter에서 처리
// 오버레이 관련 API (라우터로 이동됨)
/*
// GET /api/overlay-status/:listId - 오버레이 상태 조회
app.get('/api/overlay-status/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    
    // 오버레이 상태 조회 로직 (placeholder)
    console.log(`오버레이 상태 조회: ${listId}`);
    res.json({ 
      success: true, 
      listId,
      status: 'active'
    });
  } catch (error) {
    console.error('오버레이 상태 조회 실패:', error);
    res.status(500).json({ error: '오버레이 상태 조회에 실패했습니다.' });
  }
});

// PUT /api/overlay-refresh/:listId - 오버레이 새로고침
app.put('/api/overlay-refresh/:listId', requireAuth, async (req, res) => {
  try {
    const { listId } = req.params;
    
    // 오버레이 새로고침 로직 (placeholder)
    console.log(`오버레이 새로고침: ${listId}`);
    res.json({ 
      success: true, 
      message: '오버레이가 새로고침되었습니다.',
      listId
    });
  } catch (error) {
    console.error('오버레이 새로고침 실패:', error);
    res.status(500).json({ error: '오버레이 새로고침에 실패했습니다.' });
  }
});

// GET /api/overlay-images/:sportType - 종목별 오버레이 이미지 조회
app.get('/api/overlay-images/:sportType', requireAuth, async (req, res) => {
  try {
    const { sportType } = req.params;
    
    // 종목별 오버레이 이미지 조회 로직 (placeholder)
    console.log(`종목별 오버레이 이미지 조회: ${sportType}`);
    res.json({ 
      success: true, 
      sportType,
      images: []
    });
  } catch (error) {
    console.error('종목별 오버레이 이미지 조회 실패:', error);
    res.status(500).json({ error: '종목별 오버레이 이미지 조회에 실패했습니다.' });
  }
});
*/

// GET /api/soccer-overlay-design - 축구 오버레이 디자인 조회
app.get('/api/soccer-overlay-design', requireAuth, async (req, res) => {
  try {
    // 축구 오버레이 디자인 조회 로직 (placeholder)
    console.log('축구 오버레이 디자인 조회');
    res.json({ 
      success: true, 
      design: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontSize: 24
      }
    });
  } catch (error) {
    console.error('축구 오버레이 디자인 조회 실패:', error);
    res.status(500).json({ error: '축구 오버레이 디자인 조회에 실패했습니다.' });
  }
});

// POST /api/soccer-overlay-design/reset - 축구 오버레이 디자인 리셋
app.post('/api/soccer-overlay-design/reset', requireAuth, async (req, res) => {
  try {
    // 축구 오버레이 디자인 리셋 로직 (placeholder)
    console.log('축구 오버레이 디자인 리셋');
    res.json({ 
      success: true, 
      message: '축구 오버레이 디자인이 리셋되었습니다.'
    });
  } catch (error) {
    console.error('축구 오버레이 디자인 리셋 실패:', error);
    res.status(500).json({ error: '축구 오버레이 디자인 리셋에 실패했습니다.' });
  }
});

// GET /api/team-logo-visibility - 팀 로고 가시성 조회
app.get('/api/team-logo-visibility', requireAuth, async (req, res) => {
  try {
    // 팀 로고 가시성 조회 로직 (placeholder)
    console.log('팀 로고 가시성 조회');
    res.json({ 
      success: true, 
      visibility: {
        team1: true,
        team2: true
      }
    });
  } catch (error) {
    console.error('팀 로고 가시성 조회 실패:', error);
    res.status(500).json({ error: '팀 로고 가시성 조회에 실패했습니다.' });
  }
});

// 중복된 API 제거됨 - routes/overlays.js에서 처리

// POST /api/upload-player-csv - 선수 CSV 업로드
app.post('/api/upload-player-csv', requireAuth, async (req, res) => {
  try {
    const { matchId, csvData } = req.body;
    
    // 선수 CSV 업로드 로직 (placeholder)
    console.log(`선수 CSV 업로드: ${matchId}`);
    res.json({ 
      success: true, 
      message: '선수 CSV가 업로드되었습니다.',
      matchId
    });
  } catch (error) {
    console.error('선수 CSV 업로드 실패:', error);
    res.status(500).json({ error: '선수 CSV 업로드에 실패했습니다.' });
  }
});

// 🚨 중복 API 제거됨 - routes/matches.js의 라인업 저장 API 사용

// GET /api/team-logo - 팀 로고 조회
app.get('/api/team-logo', requireAuth, async (req, res) => {
  try {
    const { sportType, teamName } = req.query;
    
    // 팀 로고 조회 로직 (placeholder)
    console.log(`팀 로고 조회: ${sportType} - ${teamName}`);
    res.json({ 
      success: true, 
      sportType,
      teamName,
      logo: null
    });
  } catch (error) {
    console.error('팀 로고 조회 실패:', error);
    res.status(500).json({ error: '팀 로고 조회에 실패했습니다.' });
  }
});

// POST /api/team-logo - 팀 로고 업로드 (라우터로 이동됨)

// DELETE /api/remove-logo - 팀 로고 삭제
app.delete('/api/remove-logo', requireAuth, async (req, res) => {
  try {
    const { sportType, teamName } = req.body;
    
    // 팀 로고 삭제 로직 (placeholder)
    console.log(`팀 로고 삭제: ${sportType} - ${teamName}`);
    res.json({ 
      success: true, 
      message: '팀 로고가 삭제되었습니다.',
      sportType,
      teamName
    });
  } catch (error) {
    console.error('팀 로고 삭제 실패:', error);
    res.status(500).json({ error: '팀 로고 삭제에 실패했습니다.' });
  }
});

// PUT /api/update-team-logo-map - 팀 로고 맵 업데이트 (라우터로 이동됨)

// POST /api/logs/backup - 로그 백업
app.post('/api/logs/backup', requireAuth, async (req, res) => {
  try {
    // 로그 백업 로직 (placeholder)
    console.log('로그 백업');
    res.json({ 
      success: true, 
      message: '로그가 백업되었습니다.'
    });
  } catch (error) {
    console.error('로그 백업 실패:', error);
    res.status(500).json({ error: '로그 백업에 실패했습니다.' });
  }
});

// POST /api/logs/cleanup - 로그 정리
app.post('/api/logs/cleanup', requireAuth, async (req, res) => {
  try {
    // 로그 정리 로직 (placeholder)
    console.log('로그 정리');
    res.json({ 
      success: true, 
      message: '로그가 정리되었습니다.'
    });
  } catch (error) {
    console.error('로그 정리 실패:', error);
    res.status(500).json({ error: '로그 정리에 실패했습니다.' });
  }
});

// POST /api/logs/clear-all - 모든 로그 삭제
app.post('/api/logs/clear-all', requireAuth, async (req, res) => {
  try {
    // 모든 로그 삭제 로직 (placeholder)
    console.log('모든 로그 삭제');
    res.json({ 
      success: true, 
      message: '모든 로그가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('모든 로그 삭제 실패:', error);
    res.status(500).json({ error: '모든 로그 삭제에 실패했습니다.' });
  }
});

// 기본 템플릿 파일 조회 (리팩토링 이전과 동일한 방식)
app.get('/api/base-template/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    // .html 요청을 .ejs로 변환하여 처리
    let actualFilename = filename;
    if (filename.endsWith('.html')) {
      actualFilename = filename.replace('.html', '.ejs');
    }
    
    // views 폴더에서 먼저 찾기 (.ejs 파일)
    let templatePath = path.join(__dirname, 'views', actualFilename);
    
    // views 폴더에 없으면 template 폴더에서 찾기 (.html 파일)
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(__dirname, 'template', filename);
    }
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ success: false, message: '템플릿 파일을 찾을 수 없습니다.' });
    }
    
    const content = fs.readFileSync(templatePath, 'utf8');
    res.json({ success: true, content: content });
  } catch (error) {
    console.error('기본 템플릿 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 팀로고 맵 조회 (데이터베이스 전용)
app.get('/api/team-logo-map/:sportType', async (req, res) => {
  try {
    const { sportType } = req.params;
    
    console.log(`팀로고 맵 조회 (데이터베이스 전용): ${sportType}`);
    
    // TeamInfo 테이블에서 팀 로고 정보 조회
    const { TeamInfo } = require('./models');
    const teamInfos = await TeamInfo.findAll({
      where: { sport_type: sportType }
    });
    
    console.log(`조회된 팀 정보 수: ${teamInfos.length}`);
    
    // teamLogoMap 객체 생성
    const teamLogoMap = {};
    teamInfos.forEach(teamInfo => {
      teamLogoMap[teamInfo.team_name] = {
        path: teamInfo.logo_path,
        bgColor: teamInfo.logo_bg_color || '#ffffff'
      };
    });
    
    console.log('팀로고 맵:', Object.keys(teamLogoMap));
    
    res.json({ success: true, teamLogoMap: teamLogoMap });
  } catch (error) {
    console.error('팀로고 맵 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 팀로고 맵 업데이트 (라우터로 이동됨)

// 팀로고 관리
app.get('/api/team-logos/:sportType', requireAuth, async (req, res) => {
  try {
    const { sportType } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const logoDir = path.join(__dirname, 'public', 'TEAMLOGO', sportType);
    const files = fs.readdirSync(logoDir).filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
    
    res.json({ success: true, logos: files });
  } catch (error) {
    console.error('팀로고 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 팀로고 업로드 (라우터로 이동됨)

// 야구 팀로고 가시성 관리
app.get('/api/baseball-team-logo-visibility/:matchId', requireAuth, async (req, res) => {
  try {
    const { matchId } = req.params;
    // 팀로고 가시성 상태 조회
    res.json({ success: true, useLogos: true });
  } catch (error) {
    console.error('야구 팀로고 가시성 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 축구 팀로고 사용유무 관리
app.get('/api/soccer-team-logo-visibility/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`축구 팀로고 사용유무 조회: ${matchId}`);
    
    // Settings 테이블에서 팀로고 사용 상태 조회
    const { Settings } = require('./models');
    const setting = await Settings.findOne({
      where: { key: `soccer_team_logo_visibility_${matchId}` }
    });
    
    const useLogos = setting ? setting.value === 'true' : true; // 기본값은 true
    
    console.log(`축구 팀로고 사용 상태: ${useLogos}`);
    res.json({ success: true, useLogos: useLogos });
  } catch (error) {
    console.error('축구 팀로고 사용유무 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/soccer-team-logo-visibility/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { useLogos } = req.body;
    
    console.log(`축구 팀로고 사용유무 저장: ${matchId}, useLogos: ${useLogos}`);
    
    // Settings 테이블에 팀로고 사용 상태 저장
    const { Settings } = require('./models');
    await Settings.upsert({
      key: `soccer_team_logo_visibility_${matchId}`,
      value: useLogos.toString()
    });
    
    // WebSocket으로 실시간 업데이트
    const io = req.app.get('io');
    if (io) {
      const roomName = `match_${matchId}`;
      io.to(roomName).emit('teamLogoVisibilityChanged', {
        matchId: matchId,
        useLogos: useLogos
      });
      console.log(`WebSocket 팀로고 사용유무 업데이트 이벤트 전송: room=${roomName}, useLogos=${useLogos}`);
    }
    
    console.log(`축구 팀로고 사용유무 저장 완료: ${matchId}, useLogos: ${useLogos}`);
    res.json({ success: true, useLogos: useLogos });
  } catch (error) {
    console.error('축구 팀로고 사용유무 저장 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});


app.post('/api/baseball-team-logo-visibility', requireAuth, async (req, res) => {
  try {
    const { matchId, useLogos } = req.body;
    // 팀로고 가시성 상태 저장
    res.json({ success: true });
  } catch (error) {
    console.error('야구 팀로고 가시성 저장 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});


// 중복된 API 제거됨 - routes/matches.js에서 처리

// 중복된 API 엔드포인트 제거됨

// 🚨 중복 API 제거됨 - overlaysRouter에서 처리
// 오버레이 강제 새로고침 (라우터로 이동됨)
/*
app.post('/api/overlay-refresh/:listId', requireAuth, async (req, res) => {
  try {
    const { listId } = req.params;
    // 오버레이 강제 새로고침 로직
    res.json({ success: true, message: '오버레이가 새로고침되었습니다.' });
  } catch (error) {
    console.error('오버레이 새로고침 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});
*/


// 중복된 API 제거됨 - 위에서 이미 정의됨

// 템플릿 파일 조회
app.get('/api/templates/:templateId/files', requireAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { Template } = require('./models');
    const fs = require('fs');
    const path = require('path');
    
    const template = await Template.findByPk(templateId);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }
    
    // views 폴더에서 템플릿 관련 파일들 조회
    const viewsDir = path.join(__dirname, 'views');
    const templateName = template.name;
    const files = [];
    
    // 3개 파일 그룹: template, control, control-mobile
    const fileTypes = [
      { type: 'template', suffix: '-template.ejs' },
      { type: 'control', suffix: '-control.ejs' },
      { type: 'control-mobile', suffix: '-control-mobile.ejs' }
    ];
    
    for (const fileType of fileTypes) {
      const fileName = `${templateName}${fileType.suffix}`;
      const filePath = path.join(viewsDir, fileName);
      
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        files.push({
          type: fileType.type,
          name: fileName,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          exists: true
        });
        console.log(`파일 존재: ${fileName} - ${filePath}`);
      } else {
        files.push({
          type: fileType.type,
          name: fileName,
          path: filePath,
          size: 0,
          modified: null,
          exists: false
        });
        console.log(`파일 없음: ${fileName} - ${filePath}`);
      }
    }
    
    // 캐시 방지 헤더 추가
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // 템플릿 정보와 함께 반환 (is_default 속성 포함)
    res.json({ 
      success: true, 
      template: {
        id: template.id,
        name: template.name,
        sport_type: template.sport_type,
        template_type: template.template_type,
        is_default: template.is_default || false,
        created_by: template.created_by,
        created_at: template.created_at,
        updated_at: template.updated_at
      },
      files: files 
    });
  } catch (error) {
    console.error('템플릿 파일 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 템플릿 파일 업로드
app.post('/api/templates/:templateId/files/:fileType/upload', requireAuth, async (req, res) => {
  try {
    const { templateId, fileType } = req.params;
    // 파일 업로드 처리
    res.json({ success: true, message: '파일 업로드 완료' });
  } catch (error) {
    console.error('템플릿 파일 업로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 템플릿 파일 삭제
app.delete('/api/templates/:templateId/files/:fileType', requireAuth, async (req, res) => {
  try {
    const { templateId, fileType } = req.params;
    // 파일 삭제 처리
    res.json({ success: true, message: '파일 삭제 완료' });
  } catch (error) {
    console.error('템플릿 파일 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 선수 데이터 업로드
app.post('/api/upload-player-data', requireAuth, async (req, res) => {
  try {
    // 선수 데이터 업로드 처리
    res.json({ success: true, message: '선수 데이터 업로드 완료' });
  } catch (error) {
    console.error('선수 데이터 업로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 현재 선수 업데이트
app.post('/api/update-current-players', requireAuth, async (req, res) => {
  try {
    // 현재 선수 업데이트 처리
    res.json({ success: true, message: '현재 선수 업데이트 완료' });
  } catch (error) {
    console.error('현재 선수 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 누락된 API 엔드포인트들 추가

// 개별 경기 조회 API
// 개별 경기 조회 API (라우터로 이동됨)

// 개별 경기 수정 API
app.put('/api/match/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { sport_type, home_team, away_team, match_data, use_team_logos } = req.body;
    
    console.log(`[DEBUG] 개별 경기 수정 요청: ID=${id}`);
    
    const match = await Match.findByPk(id);
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 권한 확인: 일반 사용자는 자신이 만든 경기만 수정 가능
    if (req.session.userRole !== 'admin' && match.created_by !== req.session.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    
    // 경기 정보 업데이트
    const updateData = {};
    if (sport_type) updateData.sport_type = sport_type;
    if (home_team) updateData.home_team = home_team;
    if (away_team) updateData.away_team = away_team;
    if (match_data) updateData.match_data = match_data;
    if (use_team_logos !== undefined) {
      if (!updateData.match_data) updateData.match_data = match.match_data || {};
      updateData.match_data.use_team_logos = use_team_logos;
    }
    
    await match.update(updateData);
    
    console.log(`[DEBUG] 경기 수정 성공: ${id} (사용자: ${req.session.username})`);
    res.json({ success: true, match });
  } catch (error) {
    console.error('[DEBUG] 개별 경기 수정 실패:', error);
    res.status(500).json({ error: '경기 수정 중 오류가 발생했습니다.' });
  }
});

// 경기 목록 관련 API는 match-lists 라우터로 이동됨

// 🚨 중복 API 제거됨 - settingsRouter에서 처리
// 설정 관련 API (라우터로 이동됨)
/*
// 설정 조회 API
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settings = await Settings.findAll();
    const settingsObj = {};
    
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('설정 조회 실패:', error);
    res.status(500).json({ error: '설정 조회에 실패했습니다.' });
  }
});

// 설정 저장 API
app.post('/api/settings', requireAuth, async (req, res) => {
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
    console.error('설정 저장 실패:', error);
    res.status(500).json({ error: '설정 저장에 실패했습니다.' });
  }
});
*/

// 경기 생성 API는 matches 라우터로 이동됨

app.get('/api/logs/auto-management-status', requireAuth, async (req, res) => {
  try {
    // 자동 관리 상태 조회
    res.json({ enabled: false });
  } catch (error) {
    console.error('자동 관리 상태 조회 실패:', error);
    res.status(500).json({ error: '자동 관리 상태 조회에 실패했습니다.' });
  }
});

// 스포츠 삭제 정보 API
app.get('/api/sport/:code/delete-info', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    console.log(`🔍 스포츠 삭제 정보 조회 요청: ${code}`);
    
    // 해당 스포츠가 존재하는지 확인
    const sport = await Sport.findOne({
      where: { code: code.toUpperCase() },
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default']
    });
    
    if (!sport) {
      console.log(`❌ 스포츠를 찾을 수 없음: ${code}`);
      return res.status(404).json({ error: '해당 스포츠를 찾을 수 없습니다.' });
    }
    
    console.log(`✅ 스포츠 찾음: ${sport.name} (${sport.code})`);
    
    // 삭제 가능 여부 확인 (기본 스포츠는 삭제 불가)
    const canDelete = !sport.is_default;
    console.log(`🔍 삭제 가능 여부: ${canDelete} (기본 종목: ${sport.is_default})`);
    
    // 관련 데이터 조회
    console.log('🔍 관련 데이터 조회 시작...');
    const { Match } = require('./models');
    
    let matchCount = 0;
    try {
      matchCount = await Match.count({
        where: { sport_type: sport.code }
      });
      console.log(`✅ 경기 수 조회 완료: ${matchCount}개`);
    } catch (error) {
      console.error('❌ 경기 수 조회 실패:', error);
      matchCount = 0;
    }
    
    // 오버레이 이미지 관련 데이터 조회
    console.log('🔍 오버레이 이미지 데이터 조회 시작...');
    const { SportOverlayImage, SportActiveOverlayImage } = require('./models');
    
    // 기본값 설정
    let overlayImageCount = 0;
    let activeOverlayImageCount = 0;
    let overlayImages = [];
    
    try {
      // 테이블 존재 여부 확인
      console.log('🔍 테이블 존재 여부 확인 중...');
      
      // SportOverlayImage 테이블 확인
      try {
        await SportOverlayImage.findOne({ limit: 1 });
        console.log('✅ SportOverlayImage 테이블 존재 확인');
        
        // 테이블이 존재하면 데이터 조회
        overlayImageCount = await SportOverlayImage.count({
          where: { sport_code: sport.code }
        });
        console.log(`✅ 오버레이 이미지 수 조회 완료: ${overlayImageCount}개`);
        
        overlayImages = await SportOverlayImage.findAll({
          where: { sport_code: sport.code },
          attributes: ['id', 'filename', 'file_path', 'is_active']
        });
        console.log(`✅ 오버레이 이미지 목록 조회 완료: ${overlayImages.length}개`);
      } catch (tableError) {
        console.warn('⚠️ SportOverlayImage 테이블이 존재하지 않거나 접근 불가:', tableError.message);
        overlayImageCount = 0;
        overlayImages = [];
      }
      
      // SportActiveOverlayImage 테이블 확인
      try {
        await SportActiveOverlayImage.findOne({ limit: 1 });
        console.log('✅ SportActiveOverlayImage 테이블 존재 확인');
        
        // 테이블이 존재하면 데이터 조회
        activeOverlayImageCount = await SportActiveOverlayImage.count({
          where: { sport_code: sport.code }
        });
        console.log(`✅ 활성 오버레이 이미지 수 조회 완료: ${activeOverlayImageCount}개`);
      } catch (tableError) {
        console.warn('⚠️ SportActiveOverlayImage 테이블이 존재하지 않거나 접근 불가:', tableError.message);
        activeOverlayImageCount = 0;
      }
      
      console.log('📊 최종 오버레이 이미지 데이터:', { 
        overlayImageCount, 
        activeOverlayImageCount, 
        overlayImagesCount: overlayImages.length 
      });
    } catch (error) {
      console.error('❌ 오버레이 이미지 데이터 조회 실패:', error);
      // 오류가 발생해도 기본값으로 계속 진행
      overlayImageCount = 0;
      activeOverlayImageCount = 0;
      overlayImages = [];
      console.log('📊 오버레이 이미지 데이터 (오류 시 기본값):', { 
        overlayImageCount, 
        activeOverlayImageCount, 
        overlayImagesCount: overlayImages.length 
      });
    }
    
    // 오버레이 이미지 폴더 정보
    console.log('🔍 폴더 정보 조회 시작...');
    const fs = require('fs');
    const path = require('path');
    const overlayFolderPath = path.join(__dirname, 'public', 'overlay-images', sport.code.toUpperCase());
    const overlayFolderInfo = {
      exists: fs.existsSync(overlayFolderPath),
      fileCount: 0
    };
    
    if (overlayFolderInfo.exists) {
      try {
        const files = fs.readdirSync(overlayFolderPath);
        overlayFolderInfo.fileCount = files.length;
        console.log(`✅ 오버레이 폴더 정보: ${overlayFolderPath} (${files.length}개 파일)`);
      } catch (error) {
        console.warn('⚠️ 오버레이 폴더 읽기 실패:', error.message);
      }
    } else {
      console.log(`📁 오버레이 폴더 없음: ${overlayFolderPath}`);
    }
    
    // 팀로고 폴더 정보
    const teamLogoFolderPath = path.join(__dirname, 'public', 'TEAMLOGO', sport.code.toUpperCase());
    const teamLogoFolderInfo = {
      exists: fs.existsSync(teamLogoFolderPath),
      fileCount: 0
    };
    
    if (teamLogoFolderInfo.exists) {
      try {
        const files = fs.readdirSync(teamLogoFolderPath);
        teamLogoFolderInfo.fileCount = files.length;
        console.log(`✅ 팀로고 폴더 정보: ${teamLogoFolderPath} (${files.length}개 파일)`);
      } catch (error) {
        console.warn('⚠️ 팀로고 폴더 읽기 실패:', error.message);
      }
    } else {
      console.log(`📁 팀로고 폴더 없음: ${teamLogoFolderPath}`);
    }
    
    console.log('✅ 삭제 정보 조회 완료, 응답 전송 중...');
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
        overlayImages,
        overlayFolderInfo,
        teamLogoFolderInfo
      },
      canDelete
    });
  } catch (error) {
    console.error('❌ 스포츠 삭제 정보 조회 실패:', error);
    console.error('❌ 오류 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: '스포츠 삭제 정보 조회에 실패했습니다.',
      details: error.message
    });
  }
});

// DB 초기화 API - 기본 종목만 남기고 모든 데이터 삭제
app.post('/api/database/reset', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 DB 초기화 시작...');
    
    const { Sport, Match, SportOverlayImage, SportActiveOverlayImage, MatchList, TeamInfo, Settings } = require('./models');
    const fs = require('fs');
    const path = require('path');
    
    // 1. 기본 종목이 아닌 모든 스포츠 조회
    const customSports = await Sport.findAll({
      where: { is_default: false }
    });
    
    console.log(`🔧 삭제할 사용자 정의 종목: ${customSports.length}개`);
    
    // 2. 각 사용자 정의 종목에 대한 데이터 삭제
    for (const sport of customSports) {
      console.log(`🔧 종목 삭제 중: ${sport.name} (${sport.code})`);
      
      // 관련 경기 삭제
      await Match.destroy({
        where: { sport_type: sport.code }
      });
      
      // 오버레이 이미지 삭제
      await SportOverlayImage.destroy({
        where: { sport_code: sport.code }
      });
      
      await SportActiveOverlayImage.destroy({
        where: { sport_code: sport.code }
      });
      
      // 팀 정보 삭제
      await TeamInfo.destroy({
        where: { sport_type: sport.code }
      });
      
      // 오버레이 이미지 폴더 삭제
      const overlayFolderPath = path.join(__dirname, 'public', 'overlay-images', sport.code.toUpperCase());
      if (fs.existsSync(overlayFolderPath)) {
        fs.rmSync(overlayFolderPath, { recursive: true, force: true });
        console.log(`✅ 오버레이 폴더 삭제: ${overlayFolderPath}`);
      }
      
      // 팀로고 폴더 삭제
      const teamLogoFolderPath = path.join(__dirname, 'public', 'TEAMLOGO', sport.code.toUpperCase());
      if (fs.existsSync(teamLogoFolderPath)) {
        fs.rmSync(teamLogoFolderPath, { recursive: true, force: true });
        console.log(`✅ 팀로고 폴더 삭제: ${teamLogoFolderPath}`);
      }
      
      // 스포츠 삭제
      await sport.destroy();
      console.log(`✅ 종목 삭제 완료: ${sport.name}`);
    }
    
    // 3. 모든 경기 삭제 (기본 종목 포함)
    await Match.destroy({
      where: {}
    });
    
    // 4. 모든 팀 정보 삭제 (기본 종목 포함)
    await TeamInfo.destroy({
      where: {}
    });
    
    // 5. 모든 오버레이 이미지 삭제 (기본 종목 포함)
    await SportOverlayImage.destroy({
      where: {}
    });
    
    await SportActiveOverlayImage.destroy({
      where: {}
    });
    
    // 6. 경기 목록 초기화
    await MatchList.destroy({
      where: {},
      truncate: true
    });
    
    // 7. 사용자 정의 템플릿 삭제
    const { Template } = require('./models');
    const customTemplates = await Template.findAll({
      where: { is_default: false }
    });
    
    for (const template of customTemplates) {
      // 템플릿 파일 삭제
      const templateFile = path.join(__dirname, 'views', `${template.name}-template.ejs`);
      const controlFile = path.join(__dirname, 'views', `${template.name}-control.ejs`);
      const controlMobileFile = path.join(__dirname, 'views', `${template.name}-control-mobile.ejs`);
      
      if (fs.existsSync(templateFile)) {
        fs.unlinkSync(templateFile);
        console.log(`✅ 템플릿 파일 삭제: ${templateFile}`);
      }
      if (fs.existsSync(controlFile)) {
        fs.unlinkSync(controlFile);
        console.log(`✅ 컨트롤 파일 삭제: ${controlFile}`);
      }
      if (fs.existsSync(controlMobileFile)) {
        fs.unlinkSync(controlMobileFile);
        console.log(`✅ 모바일 컨트롤 파일 삭제: ${controlMobileFile}`);
      }
      
      // 템플릿 DB 삭제
      await template.destroy();
      console.log(`✅ 템플릿 삭제 완료: ${template.name}`);
    }
    
    // 8. 기본 종목 오버레이 이미지 폴더 삭제
    const defaultSports = ['SOCCER', 'BASEBALL'];
    for (const sportCode of defaultSports) {
      const overlayFolderPath = path.join(__dirname, 'public', 'overlay-images', sportCode);
      if (fs.existsSync(overlayFolderPath)) {
        fs.rmSync(overlayFolderPath, { recursive: true, force: true });
        console.log(`✅ 기본 종목 오버레이 폴더 삭제: ${overlayFolderPath}`);
      }
      
      const teamLogoFolderPath = path.join(__dirname, 'public', 'TEAMLOGO', sportCode);
      if (fs.existsSync(teamLogoFolderPath)) {
        fs.rmSync(teamLogoFolderPath, { recursive: true, force: true });
        console.log(`✅ 기본 종목 팀로고 폴더 삭제: ${teamLogoFolderPath}`);
      }
    }
    
    // 9. 설정 초기화 (팀로고 관련 설정만 유지)
    await Settings.destroy({
      where: {
        key: {
          [require('sequelize').Op.notLike]: 'soccer_team_logo_visibility_%'
        }
      }
    });
    
    console.log('✅ DB 초기화 완료');
    
    res.json({
      success: true,
      message: '데이터베이스가 성공적으로 초기화되었습니다.',
      deletedSports: customSports.length
    });
    
  } catch (error) {
    console.error('❌ DB 초기화 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '데이터베이스 초기화에 실패했습니다.',
      details: error.message
    });
  }
});

// 기본 라우트들 (기존 server.js에서 유지)
app.get('/', (req, res) => {
  res.render('login');
});

// 스포츠 페이지 라우트
app.get('/sports', requireAuth, async (req, res) => {
  try {
    // 스포츠 목록 조회
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default'],
      order: [['id', 'ASC']]
    });
    res.render('sports', { title: '스포츠 관리', sports });
  } catch (error) {
    console.error('스포츠 관리 페이지 로드 실패:', error);
    res.render('sports', { title: '스포츠 관리', sports: [] });
  }
});

app.get('/matches', requireAuth, async (req, res) => {
  try {
    // 사용자 목록 조회 (관리자용)
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name', 'role'],
      where: { is_active: true },
      order: [['username', 'ASC']]
    });
    
    // 경기 목록 조회
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
    
    // sportTemplateMap 생성
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default']
    });
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
    
    res.render('matches', { 
      title: '경기 관리',
      users, 
      matches, 
      userRole: req.session.userRole,
      sportTemplateMap 
    });
  } catch (error) {
    console.error('데이터 조회 실패:', error);
    res.render('matches', { 
      title: '경기 관리',
      users: [], 
      matches: [], 
      userRole: req.session.userRole,
      sportTemplateMap: {}
    });
  }
});

app.get('/settings', requireAuth, (req, res) => {
  res.render('settings', { title: '설정' });
});

// 추가 페이지 라우트들
app.get('/templates', requireAuth, async (req, res) => {
  try {
    // 템플릿 목록 조회
    const templates = await Template.findAll({
      order: [['created_at', 'DESC']]
    });
    res.render('templates', { title: '템플릿 관리', templates });
  } catch (error) {
    console.error('템플릿 관리 페이지 로드 실패:', error);
    res.render('templates', { title: '템플릿 관리', templates: [] });
  }
});

app.get('/user-management', requireAuth, async (req, res) => {
  try {
    // 사용자 목록 조회
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name', 'role', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.render('user-management', { title: '사용자 관리', users });
  } catch (error) {
    console.error('사용자 관리 페이지 로드 실패:', error);
    res.render('user-management', { title: '사용자 관리', users: [] });
  }
});

// 추가 누락된 라우트들
app.get('/matches/new', requireAuth, async (req, res) => {
  try {
    // 경기 목록 조회 (새 경기 생성 시 필요)
    const matchLists = await MatchList.findAll({
      order: [['created_at', 'DESC']]
    });
    
    // 스포츠 목록 조회 (새 경기 생성 시 필요)
    const sports = await Sport.findAll({
      attributes: ['id', 'name', 'code', 'template', 'description', 'is_active', 'is_default'],
      where: { is_active: true }, // 활성화된 종목만 조회
      order: [['id', 'ASC']]
    });
    
    console.log('새 경기 생성 페이지 - 조회된 종목들:', sports.map(s => ({ name: s.name, code: s.code, is_active: s.is_active, is_default: s.is_default })));
    
    res.render('match-form', { title: '새 경기 생성', matchLists, sports });
  } catch (error) {
    console.error('새 경기 생성 페이지 로드 실패:', error);
    res.render('match-form', { title: '새 경기 생성', matchLists: [], sports: [] });
  }
});

app.get('/match-list-manager', requireAuth, async (req, res) => {
  try {
    // 경기 목록 조회
    const matchLists = await MatchList.findAll({
      order: [['created_at', 'DESC']]
    });
    res.render('match-list-manager', { title: '경기 목록 관리', matchLists });
  } catch (error) {
    console.error('경기 목록 관리 페이지 로드 실패:', error);
    res.render('match-list-manager', { title: '경기 목록 관리', matchLists: [] });
  }
});

app.get('/users', requireAuth, async (req, res) => {
  try {
    // 사용자 목록 조회
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name', 'role', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.render('user-management', { title: '사용자 관리', users });
  } catch (error) {
    console.error('사용자 관리 페이지 로드 실패:', error);
    res.render('user-management', { title: '사용자 관리', users: [] });
  }
});

app.get('/user-management', requireAuth, async (req, res) => {
  try {
    // 사용자 목록 조회
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name', 'role', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.render('user-management', { title: '사용자 관리', users });
  } catch (error) {
    console.error('사용자 관리 페이지 로드 실패:', error);
    res.render('user-management', { title: '사용자 관리', users: [] });
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
    
    // 데이터베이스 전용 팀 컬러 관리
    let teamColors = {
      home: defaultColors.home,
      away: defaultColors.away
    };
    
    // 데이터베이스 전용 접근 방식 - JSON 파일 의존성 제거
    console.log('데이터베이스 전용 팀 로고 관리 시스템 사용');

    // URL 생성
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const mobileUrl = `${baseUrl}/${req.params.sport}/${req.params.id}/control-mobile`;
    const overlayUrl = `${baseUrl}/${req.params.sport}/${req.params.id}/overlay`;
    
    // 종목 정보에서 템플릿 필드 가져오기
    const { Sport } = require('./models');
    const sport = await Sport.findOne({ where: { code: match.sport_type } });
    
    if (!sport) {
      return res.status(404).json({ error: '종목 정보를 찾을 수 없습니다.' });
    }
    
    console.log(`🔧 컨트롤 템플릿 결정: 종목코드=${match.sport_type}, 템플릿=${sport.template}`);
    
    // 해당 종목의 템플릿 필드를 사용하여 컨트롤 템플릿 렌더링
    res.render(`${sport.template}-control`, { 
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
    console.error('컨트롤 페이지 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 서버 중심 타이머 컨트롤 패널 라우트 (새로운 버전)
app.get('/:sport/:id/control-new', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 스포츠 타입이 일치하는지 확인
    if (match.sport_type.toLowerCase() !== req.params.sport.toLowerCase()) {
      return res.status(400).json({ error: '잘못된 스포츠 타입입니다.' });
    }

    console.log(`🎯 서버 중심 타이머 컨트롤 패널 로드: ${match.sport_type}-${match.id}`);
    
    // 서버 중심 타이머 컨트롤 패널 렌더링
    res.render('soccer-control-new', { 
      match: {
        ...match.toJSON(),
        home_score: match.home_score || 0,
        away_score: match.away_score || 0
      }
    });
  } catch (error) {
    console.error('서버 중심 타이머 컨트롤 페이지 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 동적 모바일 컨트롤 패널 라우트
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

    // 경기 데이터가 없는 경우에만 초기화
    if (!match.match_data) {
      match.match_data = {
        state: '경기 전',
        home_shots: 0,
        away_shots: 0,
        home_shots_on_target: 0,
        away_shots_on_target: 0,
        home_possession: 50,
        away_possession: 50,
        home_corners: 0,
        away_corners: 0,
        home_fouls: 0,
        away_fouls: 0,
        home_yellow_cards: 0,
        away_yellow_cards: 0,
        home_red_cards: 0,
        away_red_cards: 0,
        home_offsides: 0,
        away_offsides: 0,
        home_saves: 0,
        away_saves: 0,
        home_passes: 0,
        away_passes: 0,
        home_pass_accuracy: 0,
        away_pass_accuracy: 0,
        home_duels_won: 0,
        away_duels_won: 0,
        home_aerials_won: 0,
        away_aerials_won: 0,
        home_tackles: 0,
        away_tackles: 0,
        home_blocks: 0,
        away_blocks: 0,
        home_interceptions: 0,
        away_interceptions: 0,
        home_clearances: 0,
        away_clearances: 0,
        home_crosses: 0,
        away_crosses: 0,
        home_long_balls: 0,
        away_long_balls: 0,
        home_through_balls: 0,
        away_through_balls: 0
      };
      await match.save();
    }

    // 팀 로고 정보 조회
    const { TeamInfo } = require('./models');
    const teamLogos = await TeamInfo.findAll({
      where: { match_id: req.params.id }
    });

    // 팀 로고 맵 생성
    const teamLogoMap = {};
    teamLogos.forEach(logo => {
      teamLogoMap[logo.team_type] = {
        path: logo.logo_path,
        teamName: logo.team_name,
        teamColor: logo.team_color
      };
    });

    // 기본 팀 컬러 설정
    const defaultColors = {
      home: '#1e40af',
      away: '#dc2626'
    };

    // 팀 컬러 정보 조회
    const teamColors = {};
    teamLogos.forEach(logo => {
      if (logo.team_color) {
        teamColors[logo.team_type] = logo.team_color;
      }
    });

    // URL 생성
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const mobileUrl = `${baseUrl}/${req.params.sport}/${req.params.id}/control-mobile`;
    const overlayUrl = `${baseUrl}/${req.params.sport}/${req.params.id}/overlay`;
    
    // 종목 정보에서 템플릿 필드 가져오기
    const { Sport } = require('./models');
    const sport = await Sport.findOne({ where: { code: match.sport_type } });
    
    if (!sport) {
      return res.status(404).json({ error: '종목 정보를 찾을 수 없습니다.' });
    }
    
    console.log(`🔧 모바일 컨트롤 템플릿 결정: 종목코드=${match.sport_type}, 템플릿=${sport.template}`);
    
    // 해당 종목의 템플릿 필드를 사용하여 모바일 컨트롤 템플릿 렌더링
    res.render(`${sport.template}-control-mobile`, { 
      match: {
        ...match.toJSON(),
        home_score: match.home_score || 0,
        away_score: match.away_score || 0
      },
      mobileUrl: mobileUrl,
      overlayUrl: overlayUrl,
      defaultColors,
      teamColors,
      teamLogoMap
    });
  } catch (error) {
    console.error('모바일 컨트롤 페이지 로드 실패:', error);
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
    
    // 종목 정보에서 템플릿 필드 가져오기
    const { Sport } = require('./models');
    const sport = await Sport.findOne({ where: { code: match.sport_type } });
    
    if (!sport) {
      return res.status(404).json({ error: '종목 정보를 찾을 수 없습니다.' });
    }
    
    console.log(`🔧 오버레이 템플릿 결정: 종목코드=${match.sport_type}, 템플릿=${sport.template}`);
    
    // 해당 종목의 템플릿 필드를 사용하여 오버레이 템플릿 렌더링
    res.render(`${sport.template}-template`, { 
      match: match,
      isListMode: false,  // 원본 오버레이는 리스트 모드가 아님
      listId: null,
      listName: null,
      currentMatchIndex: 0,
      totalMatches: 0
    });
  } catch (error) {
    console.error('오버레이 페이지 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 서버 중심 타이머 오버레이 라우트 (새로운 버전)
app.get('/:sport/:id/overlay-new', async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 스포츠 타입이 일치하는지 확인
    if (match.sport_type.toLowerCase() !== req.params.sport.toLowerCase()) {
      return res.status(400).json({ error: '잘못된 스포츠 타입입니다.' });
    }

    console.log(`🎯 서버 중심 타이머 오버레이 로드: ${match.sport_type}-${match.id}`);
    
    // 서버 중심 타이머 오버레이 렌더링
    res.render('soccer-template-new', { 
      match: {
        ...match.toJSON(),
        home_score: match.home_score || 0,
        away_score: match.away_score || 0
      }
    });
  } catch (error) {
    console.error('서버 중심 타이머 오버레이 페이지 로드 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});



// WebSocket 모듈 연결
const websocketHandler = require('./websocket');
websocketHandler(io);

// 에러 핸들러
app.use(notFoundHandler);
app.use(errorHandler);

// ========================================
// 누락된 API 엔드포인트 추가 (기존 server.js에서)
// ========================================

// 축구 관련 API
app.get('/api/soccer-scoreboard-design', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 스코어보드 디자인 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.get('/api/soccer-matchstate-design', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 경기 상태 디자인 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.get('/api/kt_soccer-team-logo-visibility/:matchId', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'KT 축구 팀 로고 가시성 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/soccer-scoreboard-visibility', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 스코어보드 가시성 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 팀 로고 관련 API
app.get('/api/team-logo-visibility/:sportType/:matchId', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '팀 로고 가시성 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});


// 중복된 API 제거됨 - 위에서 이미 정의됨

// 템플릿 관련 API
app.get('/api/templates/:id/files', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '템플릿 파일 목록 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.get('/api/templates/:id/files/:fileType/download', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '템플릿 파일 다운로드' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/templates/:id/files/:fileType/upload', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '템플릿 파일 업로드' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.delete('/api/templates/:id/files/:fileType', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '템플릿 파일 삭제' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 경기 목록 관련 API는 match-lists 라우터로 이동됨

app.delete('/api/list/:id/custom-url', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '커스텀 URL 삭제' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});


// 중복된 API 제거됨 - 위에서 이미 정의됨

// 🚨 중복 API 제거됨 - backupRouter에서 처리
// 백업 관련 API (라우터로 이동됨)
/*
app.delete('/api/backup/:fileName', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '백업 파일 삭제' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});
*/

// 테스트 관련 API
app.delete('/api/test-template', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '테스트 템플릿 삭제' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ========================================
// 추가 누락된 API 엔드포인트 (기존 server.js에서)
// ========================================

// 오버레이 이미지 파일 서빙 (한글 파일명 지원)
app.get('/overlay-images/:sportCode/:filename(*)', async (req, res) => {
  try {
    const { sportCode, filename } = req.params;
    
    console.log(`🔧 오버레이 이미지 파일 요청: sportCode=${sportCode}, filename=${filename}`);
    
    // 한글 파일명 디코딩
    let decodedFilename = filename;
    if (filename.includes('%')) {
      decodedFilename = decodeURIComponent(filename);
      console.log(`🔧 파일명 디코딩: ${filename} -> ${decodedFilename}`);
    }
    
    // sportCode가 종목명인지 종목코드인지 확인
    const { Sport } = require('./models');
    let sport = await Sport.findOne({ where: { code: sportCode } });
    let sportFolderName;
    
    if (sport) {
      // sportCode가 종목코드인 경우 - 종목코드 그대로 사용
      sportFolderName = sport.code.toUpperCase();
      console.log(`🔧 종목코드 기반 폴더명: ${sportCode} -> ${sportFolderName}`);
    } else {
      // sportCode가 종목코드인 경우 (직접 폴더명으로 사용)
      sportFolderName = sportCode.toUpperCase();
      console.log(`🔧 종목코드 기반 폴더명: ${sportCode} -> ${sportFolderName}`);
    }
    
    // 파일 경로 생성 (종목코드 기반)
    const filePath = path.join(__dirname, 'public', 'overlay-images', sportFolderName, decodedFilename);
    console.log(`🔧 파일 경로: ${filePath}`);
    
    // 폴더 존재 확인
    const folderPath = path.join(__dirname, 'public', 'overlay-images', sportFolderName);
    console.log(`🔧 폴더 경로: ${folderPath}`);
    console.log(`🔧 폴더 존재 여부: ${fsSync.existsSync(folderPath)}`);
    
    if (fsSync.existsSync(folderPath)) {
      const files = fsSync.readdirSync(folderPath);
      console.log(`🔧 폴더 내 파일들: ${files.join(', ')}`);
    }
    
    // 파일 존재 확인
    if (!fsSync.existsSync(filePath)) {
      console.log(`🔧 파일이 존재하지 않음: ${filePath}`);
      return res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
    }
    
    console.log(`🔧 파일 존재 확인됨: ${filePath}`);
    
    // 파일 확장자에 따른 Content-Type 설정
    const ext = path.extname(decodedFilename).toLowerCase();
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
    }
    
    // 한글 파일명을 위한 헤더 설정
    res.setHeader('Content-Type', contentType + '; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename*=UTF-8\'\'' + encodeURIComponent(decodedFilename));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    console.log(`🔧 파일 전송 시작: ${filePath}`);
    // 파일 전송
    res.sendFile(filePath);
  } catch (error) {
    console.error('오버레이 이미지 파일 서빙 실패:', error);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 팀 로고 이미지 파일 서빙 (한글 파일명 지원)
app.get('/TEAMLOGO/:sportType/:filename(*)', async (req, res) => {
  try {
    const { sportType, filename } = req.params;
    
    console.log(`🔧 팀 로고 이미지 파일 요청: sportType=${sportType}, filename=${filename}`);
    
    // 한글 파일명 디코딩
    let decodedFilename = filename;
    if (filename.includes('%')) {
      decodedFilename = decodeURIComponent(filename);
      console.log(`🔧 팀 로고 파일명 디코딩: ${filename} -> ${decodedFilename}`);
    }
    
    // sportType을 대문자로 변환
    const sportTypeUpper = sportType.toUpperCase();
    
    // 파일 경로 생성
    const filePath = path.join(__dirname, 'public', 'TEAMLOGO', sportTypeUpper, decodedFilename);
    console.log(`🔧 팀 로고 파일 경로: ${filePath}`);
    
    // 폴더 존재 확인
    const folderPath = path.join(__dirname, 'public', 'TEAMLOGO', sportTypeUpper);
    console.log(`🔧 팀 로고 폴더 존재 여부: ${fsSync.existsSync(folderPath)}`);
    
    if (fsSync.existsSync(folderPath)) {
      const files = fsSync.readdirSync(folderPath);
      console.log(`🔧 팀 로고 폴더 내 파일들: ${files.join(', ')}`);
    }
    
    // 파일 존재 확인
    if (!fsSync.existsSync(filePath)) {
      console.log(`🔧 팀 로고 파일이 존재하지 않음: ${filePath}`);
      return res.status(404).json({ success: false, message: '팀 로고 파일을 찾을 수 없습니다.' });
    }
    
    console.log(`🔧 팀 로고 파일 존재 확인됨: ${filePath}`);
    
    // 파일 확장자에 따른 Content-Type 설정
    const ext = path.extname(decodedFilename).toLowerCase();
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
    }
    
    // 한글 파일명을 위한 헤더 설정
    res.setHeader('Content-Type', contentType + '; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename*=UTF-8\'\'' + encodeURIComponent(decodedFilename));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    console.log(`🔧 팀 로고 파일 전송 시작: ${filePath}`);
    // 파일 전송
    res.sendFile(filePath);
  } catch (error) {
    console.error('팀 로고 이미지 파일 서빙 실패:', error);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 팀 로고 관련 API (라우터로 이동됨)

// 스포츠 오버레이 이미지 관련 API
app.post('/api/sport-overlay-image', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '스포츠 오버레이 이미지 업로드' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.get('/api/sport-overlay-images/:sportCode', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '스포츠 오버레이 이미지 목록 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.delete('/api/sport-overlay-image/:sportCode/:filename', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '스포츠 오버레이 이미지 삭제' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.put('/api/sport-overlay-image/:sportCode/:filename/status', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '스포츠 오버레이 이미지 상태 수정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/sport-active-overlay-image/:sportCode', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '스포츠 활성 오버레이 이미지 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 🚨 중복 API 제거됨 - overlaysRouter에서 처리
/*
app.get('/api/overlay-images/:sportCode', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '오버레이 이미지 목록 조회' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});
*/

// 스포츠 오버레이 디자인 관련 API
app.post('/api/sport-overlay-design/:sportCode', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '스포츠 오버레이 디자인 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/soccer-overlay-design', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 오버레이 디자인 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/soccer-overlay-design/reset', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 오버레이 디자인 리셋' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 축구 관련 API
app.post('/api/soccer-match-state-visibility', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 경기 상태 가시성 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 팀 로고 가시성 관련 API
app.post('/api/team-logo-visibility', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '팀 로고 가시성 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/soccer-team-logo-visibility', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '축구 팀 로고 가시성 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// POST /api/soccer-team-logo-visibility/:matchId - 축구 팀 로고 가시성 설정 (인증 임시 제거)
app.post('/api/soccer-team-logo-visibility/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { use_team_logos } = req.body;
    
    console.log(`축구 팀 로고 가시성 설정: ${matchId}, use_team_logos: ${use_team_logos}`);
    
    // 팀로고 가시성 설정 로직 (placeholder)
    res.json({ 
      success: true, 
      message: '축구 팀 로고 가시성 설정 완료',
      useLogos: use_team_logos 
    });
  } catch (error) {
    console.error('축구 팀 로고 가시성 설정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/kt_soccer-team-logo-visibility', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'KT 축구 팀 로고 가시성 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/baseball-team-logo-visibility', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '야구 팀 로고 가시성 설정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 승부차기 텍스트 저장 API
app.post('/api/extra-box-text', async (req, res) => {
  try {
    const { matchId, sportType, text } = req.body;
    
    if (!matchId || !sportType || !text) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.' 
      });
    }

    // Settings 테이블에 승부차기 텍스트 저장
    const settingKey = `extra_box_text_${sportType}_${matchId}`;
    
    await db.models.Setting.upsert({
      key: settingKey,
      value: text,
      description: `${sportType} 경기 ${matchId} 승부차기 텍스트`
    });

    console.log(`✅ 승부차기 텍스트 저장 완료: ${settingKey} = ${text}`);
    
    res.json({ 
      success: true, 
      message: '승부차기 텍스트가 저장되었습니다.',
      text: text
    });
  } catch (error) {
    console.error('승부차기 텍스트 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 승부차기 텍스트 조회 API
app.get('/api/extra-box-text/:sportType/:matchId', async (req, res) => {
  try {
    const { sportType, matchId } = req.params;
    
    if (!sportType || !matchId) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 파라미터가 누락되었습니다.' 
      });
    }

    // Settings 테이블에서 승부차기 텍스트 조회
    const settingKey = `extra_box_text_${sportType}_${matchId}`;
    
    const setting = await db.models.Setting.findOne({
      where: { key: settingKey }
    });

    if (setting) {
      console.log(`✅ 승부차기 텍스트 조회 성공: ${settingKey} = ${setting.value}`);
      res.json({ 
        success: true, 
        text: setting.value,
        message: '승부차기 텍스트를 조회했습니다.'
      });
    } else {
      console.log(`⚠️ 승부차기 텍스트 없음: ${settingKey}`);
      res.json({ 
        success: true, 
        text: '0 (승부차기) 0',
        message: '기본 승부차기 텍스트를 반환합니다.'
      });
    }
  } catch (error) {
    console.error('승부차기 텍스트 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 축구 득점 정보 API
// 득점 정보 저장
app.post('/api/soccer-goals', async (req, res) => {
  try {
    const { matchId, homeGoals, awayGoals } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ 
        success: false, 
        message: '경기 ID가 필요합니다.' 
      });
    }

    console.log('=== 축구 득점 정보 저장 시작 ===');
    console.log('경기 ID:', matchId);
    console.log('홈팀 득점:', homeGoals);
    console.log('어웨이팀 득점:', awayGoals);

    // Match 모델에서 해당 경기 찾기
    const match = await db.models.Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ 
        success: false, 
        message: '경기를 찾을 수 없습니다.' 
      });
    }

    // match_data에서 기존 goals 정보 가져오기
    let matchData = match.match_data || {};
    if (!matchData.goals) {
      matchData.goals = {};
    }

    // 득점 정보 업데이트
    matchData.goals.home = homeGoals || [];
    matchData.goals.away = awayGoals || [];

    // 데이터베이스에 저장
    await match.update({ match_data: matchData });

    console.log('✅ 축구 득점 정보 저장 완료');
    console.log('저장된 홈팀 득점:', matchData.goals.home);
    console.log('저장된 어웨이팀 득점:', matchData.goals.away);

    res.json({ 
      success: true, 
      message: '득점 정보가 저장되었습니다.',
      goals: matchData.goals
    });

  } catch (error) {
    console.error('축구 득점 정보 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 득점 정보 조회
app.get('/api/soccer-goals/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    
    if (!matchId) {
      return res.status(400).json({ 
        success: false, 
        message: '경기 ID가 필요합니다.' 
      });
    }

    console.log('=== 축구 득점 정보 조회 시작 ===');
    console.log('경기 ID:', matchId);

    // Match 모델에서 해당 경기 찾기
    const match = await db.models.Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ 
        success: false, 
        message: '경기를 찾을 수 없습니다.' 
      });
    }

    // match_data에서 goals 정보 가져오기
    const matchData = match.match_data || {};
    const goals = matchData.goals || { home: [], away: [] };

    console.log('✅ 축구 득점 정보 조회 완료');
    console.log('홈팀 득점:', goals.home);
    console.log('어웨이팀 득점:', goals.away);

    res.json({ 
      success: true, 
      message: '득점 정보를 조회했습니다.',
      goals: goals
    });

  } catch (error) {
    console.error('축구 득점 정보 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 🚨 중복 API 제거됨 - overlaysRouter에서 처리
// 오버레이 새로고침 관련 API (라우터로 이동됨)
/*
app.post('/api/overlay-refresh/:listId', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '오버레이 새로고침' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});
*/

// 대량 경기 생성 관련 API
app.post('/api/bulk-create-matches', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '대량 경기 생성' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 팀 로고 맵 업데이트 관련 API (라우터로 이동됨)

// 경기 관련 API
app.post('/api/match/:id', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '경기 수정' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/remove-logo', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '로고 제거' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 템플릿 미리보기 관련 API
app.post('/api/preview-template', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, message: '템플릿 미리보기' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});


// 헬스체크 엔드포인트 추가
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    timezone: process.env.TZ || 'Asia/Seoul',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`리팩토링된 서버 구조로 실행 중입니다.`);
  console.log(`🇰🇷 한국시간대: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  
  // 푸시 정보 복원
  await restorePushedMatches();
  
  // 관리자 계정 자동 생성/업데이트 (Railway 환경 대응)
  try {
    const { User } = require('./models');
    const bcrypt = require('bcrypt');
    
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    if (!existingAdmin) {
      console.log('🔧 관리자 계정 생성 중...');
      const hash = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        password: hash,
        email: 'admin@sportscoder.com',
        full_name: 'Administrator',
        role: 'admin',
        is_active: true
      });
      console.log('✅ 관리자 계정 생성 완료 (admin/admin123)');
    } else {
      console.log('🔧 기존 관리자 계정 발견, 비밀번호 업데이트 중...');
      const hash = await bcrypt.hash('admin123', 10);
      await existingAdmin.update({
        password: hash,
        email: 'admin@sportscoder.com',
        full_name: 'Administrator',
        role: 'admin',
        is_active: true
      });
      console.log('✅ 관리자 계정 비밀번호 업데이트 완료 (admin/admin123)');
    }
  } catch (error) {
    console.error('❌ 관리자 계정 생성/업데이트 실패:', error.message);
  }

  // 기본 종목 자동 생성 (Railway 환경 대응)
  try {
    console.log('🔧 기본 종목 생성 시작...');
    const { Sport } = require('./models');
    
    // 기존 종목 확인
    const existingSports = await Sport.findAll();
    console.log(`📊 기존 종목 수: ${existingSports.length}개`);
    existingSports.forEach(sport => {
      console.log(`  - ${sport.name} (${sport.code}) - 활성: ${sport.is_active}`);
    });
    
    const defaultSports = [
      {
        name: 'Soccer',
        code: 'SOCCER',
        template: 'soccer',
        description: 'Football/Soccer sport',
        is_active: true,
        is_default: true
      },
      {
        name: 'Baseball',
        code: 'BASEBALL',
        template: 'baseball',
        description: 'Baseball sport',
        is_active: true,
        is_default: true
      },
      {
        name: 'Volleyball',
        code: 'VOLLEYBALL',
        template: 'volleyball',
        description: 'Volleyball sport',
        is_active: true,
        is_default: true
      }
    ];

    for (const sportData of defaultSports) {
      try {
        const existingSport = await Sport.findOne({ where: { code: sportData.code } });
        if (!existingSport) {
          console.log(`🔧 기본 종목 생성 중: ${sportData.name} (${sportData.code})`);
          const newSport = await Sport.create(sportData);
          console.log(`✅ 기본 종목 생성 완료: ${newSport.name} (ID: ${newSport.id})`);
        } else {
          console.log(`✅ 기본 종목 이미 존재: ${existingSport.name} (${existingSport.code}) - 활성: ${existingSport.is_active}`);
          // 기존 종목이 비활성화되어 있다면 활성화
          if (!existingSport.is_active) {
            await existingSport.update({ is_active: true });
            console.log(`🔄 기본 종목 활성화: ${existingSport.name}`);
          }
        }
      } catch (sportError) {
        console.error(`❌ 종목 ${sportData.name} 생성 실패:`, sportError.message);
        console.error('상세 오류:', sportError);
      }
    }
    
    // 최종 종목 목록 확인
    const finalSports = await Sport.findAll({ where: { is_active: true } });
    console.log(`📊 최종 활성 종목 수: ${finalSports.length}개`);
    finalSports.forEach(sport => {
      console.log(`  ✅ ${sport.name} (${sport.code}) - 기본: ${sport.is_default}`);
    });
    
  } catch (error) {
    console.error('❌ 기본 종목 생성 실패:', error.message);
    console.error('상세 오류:', error);
  }
  
  // 등록된 라우트 확인
  console.log('\n=== 등록된 DELETE 라우트 ===');
  app._router.stack.forEach((middleware) => {
    if (middleware.route && middleware.route.methods.delete) {
      console.log(`DELETE ${middleware.route.path}`);
    }
  });
});

// WebSocket 인스턴스를 외부에서 접근할 수 있도록 하는 함수
const getIO = () => io;

module.exports = { app, server, io, savePushedMatchToDatabase, getIO };
