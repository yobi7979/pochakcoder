// SportsCoder WebSocket 경기 이벤트 처리
const { Match } = require('../../models');

/**
 * 경기 관련 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const matchEvents = (socket, io) => {
  console.log('경기 이벤트 설정 시작:', socket.id);

  // 경기 업데이트 이벤트 처리
  socket.on('match_updated', async (data) => {
    try {
      const { matchId, home_score, away_score, state, match_data, home_team, away_team } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`경기 업데이트 요청: matchId=${matchId}, score=${home_score}-${away_score}, state=${state}`);
      console.log(`야구 데이터:`, match_data);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        const updateData = {};
        if (home_score !== undefined) updateData.home_score = home_score;
        if (away_score !== undefined) updateData.away_score = away_score;
        if (state !== undefined) updateData.status = state;
        if (home_team !== undefined) updateData.home_team = home_team;
        if (away_team !== undefined) updateData.away_team = away_team;
        if (match_data !== undefined) updateData.match_data = match_data;
        
        await match.update(updateData);
        console.log(`경기 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 경기 업데이트 이벤트 전송
      io.to(roomName).emit('match_updated', {
        matchId: matchId,
        home_score: home_score,
        away_score: away_score,
        home_team: home_team,
        away_team: away_team,
        match_data: match_data,
        state: state
      });
      
      // 오버레이 페이지를 위한 match_update 이벤트도 전송
      io.to(roomName).emit('match_update', {
        matchId: matchId,
        home_score: home_score,
        away_score: away_score,
        home_team: home_team,
        away_team: away_team,
        match_data: match_data,
        state: state
      });
      
      console.log(`경기 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('경기 업데이트 처리 중 오류 발생:', error);
      socket.emit('match_update_error', { error: '경기 업데이트에 실패했습니다.' });
    }
  });

  // 경기 데이터 업데이트 이벤트 처리
  socket.on('match_update', async (data) => {
    try {
      const { matchId, data: updateData } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`경기 데이터 업데이트 요청: matchId=${matchId}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        const currentMatchData = match.match_data || {};
        const newMatchData = { ...currentMatchData, ...updateData };
        
        await match.update({ match_data: newMatchData });
        console.log(`경기 데이터 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 경기 데이터 업데이트 이벤트 전송
      io.to(roomName).emit('match_data_updated', {
        matchId: matchId,
        data: updateData
      });
      
      console.log(`경기 데이터 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('경기 데이터 업데이트 처리 중 오류 발생:', error);
      socket.emit('match_update_error', { error: '경기 데이터 업데이트에 실패했습니다.' });
    }
  });

  // 경기 상태 변경 이벤트 처리
  socket.on('matchStateChanged', (data) => {
    const { matchId, matchState } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`경기 상태 변경: matchId=${matchId}, state=${matchState}`);
    
    // 해당 방의 모든 클라이언트에게 경기 상태 변경 이벤트 전송
    io.to(roomName).emit('matchStateChanged', {
      matchId: matchId,
      matchState: matchState
    });
    
    console.log(`경기 상태 변경 이벤트를 방 ${roomName}에 전송함: ${matchState}`);
  });

  // 점수 변경 이벤트 처리
  socket.on('scoreChanged', (data) => {
    const { matchId, homeScore, awayScore } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`점수 변경: matchId=${matchId}, score=${homeScore}-${awayScore}`);
    
    // 해당 방의 모든 클라이언트에게 점수 변경 이벤트 전송
    io.to(roomName).emit('scoreChanged', {
      matchId: matchId,
      homeScore: homeScore,
      awayScore: awayScore
    });
    
    console.log(`점수 변경 이벤트를 방 ${roomName}에 전송함: ${homeScore}-${awayScore}`);
  });

  // 득점 정보 업데이트 이벤트 처리
  socket.on('goalsUpdated', async (data) => {
    try {
      const { matchId, homeGoals, awayGoals } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`득점 정보 업데이트: matchId=${matchId}, goals=${homeGoals}-${awayGoals}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        const matchData = { ...match.match_data } || {};
        matchData.home_goals = homeGoals;
        matchData.away_goals = awayGoals;
        
        await match.update({ match_data: matchData });
        console.log(`득점 정보 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 득점 정보 업데이트 이벤트 전송
      io.to(roomName).emit('goalsUpdated', {
        matchId: matchId,
        homeGoals: homeGoals,
        awayGoals: awayGoals
      });
      
      console.log(`득점 정보 업데이트 이벤트를 방 ${roomName}에 전송함: ${homeGoals}-${awayGoals}`);
    } catch (error) {
      console.error('득점 정보 업데이트 처리 중 오류 발생:', error);
      socket.emit('goals_update_error', { error: '득점 정보 업데이트에 실패했습니다.' });
    }
  });

  // 경기 점수 동기화 이벤트 처리
  socket.on('sync_match_scores', async (data) => {
    try {
      const { matchId, home_score, away_score } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`경기 점수 동기화: matchId=${matchId}, score=${home_score}-${away_score}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        await match.update({
          home_score: home_score,
          away_score: away_score
        });
        console.log(`경기 점수 동기화 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 점수 동기화 이벤트 전송
      io.to(roomName).emit('scores_synced', {
        matchId: matchId,
        home_score: home_score,
        away_score: away_score
      });
      
      console.log(`점수 동기화 이벤트를 방 ${roomName}에 전송함: ${home_score}-${away_score}`);
    } catch (error) {
      console.error('경기 점수 동기화 처리 중 오류 발생:', error);
      socket.emit('sync_scores_error', { error: '경기 점수 동기화에 실패했습니다.' });
    }
  });

  // 야구 경기 업데이트 이벤트 처리
  socket.on('baseball_update', async (data) => {
    try {
      const { matchId, data: matchData } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`야구 경기 업데이트: matchId=${matchId}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        const currentMatchData = match.match_data || {};
        const newMatchData = { ...currentMatchData, ...matchData };
        
        await match.update({ match_data: newMatchData });
        console.log(`야구 경기 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 야구 경기 업데이트 이벤트 전송
      io.to(roomName).emit('baseball_updated', {
        matchId: matchId,
        data: matchData
      });
      
      console.log(`야구 경기 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('야구 경기 업데이트 처리 중 오류 발생:', error);
      socket.emit('baseball_update_error', { error: '야구 경기 업데이트에 실패했습니다.' });
    }
  });

  // 야구 이닝 점수 업데이트 이벤트 처리
  socket.on('baseball_inning_score_update', async (data) => {
    try {
      const { matchId, team, inning, inningType, score, change } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`야구 이닝 점수 업데이트: matchId=${matchId}, team=${team}, inning=${inning}, score=${score}`);
      console.log(`전체 데이터:`, data);
      
      // 1. 데이터베이스에서 현재 경기 데이터 가져오기
      const { Match } = require('../../models');
      const match = await Match.findByPk(matchId);
      
      if (!match) {
        console.error(`경기를 찾을 수 없습니다: ${matchId}`);
        socket.emit('baseball_inning_update_error', { error: '경기를 찾을 수 없습니다.' });
        return;
      }
      
      // 2. match_data에서 이닝 점수 업데이트
      let matchData = match.match_data || {};
      if (!matchData.innings) {
        matchData.innings = {
          home: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0},
          away: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0}
        };
      }
      
      const innings = matchData.innings;
      console.log(`업데이트 전 innings:`, innings);
      console.log(`업데이트할 위치: ${team}[${parseInt(inning)}] = ${parseInt(score)}`);
      
      innings[team][parseInt(inning)] = parseInt(score);
      console.log(`업데이트 후 innings:`, innings);
      
      // 3. 총 점수 계산
      const homeTotal = Object.values(innings.home).reduce((sum, score) => sum + score, 0);
      const awayTotal = Object.values(innings.away).reduce((sum, score) => sum + score, 0);
      console.log(`계산된 총 점수: 홈팀 ${homeTotal}, 원정팀 ${awayTotal}`);
      
      // 4. Match 테이블의 match_data와 총 점수 업데이트
      await match.update({
        match_data: matchData,
        home_score: homeTotal,
        away_score: awayTotal
      });
      
      console.log(`야구 이닝 점수 업데이트 완료: ${team}팀 ${inning}회 = ${score}`);
      console.log(`야구 총 점수 업데이트 완료: 홈팀 ${homeTotal}, 원정팀 ${awayTotal}`);
      
      // 5. 이닝별 점수 데이터 구성 (match_data 구조에서)
      const inningsData = {};
      Object.keys(innings.home).forEach(inningNum => {
        inningsData[`home_${inningNum}`] = innings.home[inningNum];
      });
      Object.keys(innings.away).forEach(inningNum => {
        inningsData[`away_${inningNum}`] = innings.away[inningNum];
      });
      
      // 6. 해당 방의 모든 클라이언트에게 야구 이닝 점수 업데이트 이벤트 전송
      io.to(roomName).emit('baseball_inning_score_updated', {
        matchId: matchId,
        team: team,
        inning: inning,
        inningType: inningType,
        score: score,
        change: change,
        innings: inningsData,
        home_score: homeTotal,
        away_score: awayTotal
      });
      
      console.log(`야구 이닝 점수 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('야구 이닝 점수 업데이트 처리 중 오류 발생:', error);
      socket.emit('baseball_inning_update_error', { error: '야구 이닝 점수 업데이트에 실패했습니다.' });
    }
  });

  // 경기 방 참여 이벤트 처리
  socket.on('join', (matchId) => {
    const roomName = `match_${matchId}`;
    socket.join(roomName);
    console.log(`클라이언트 ${socket.id}가 경기 방 ${roomName}에 참여함`);
    
    // 방 참가 확인 이벤트 전송
    socket.emit('joined_room', { 
      roomName: roomName, 
      matchId: matchId,
      clientId: socket.id 
    });
    console.log(`✅ 방 참가 확인 이벤트 전송: ${roomName}`);
  });

  // 경기 방 참여 이벤트 처리 (join_match)
  socket.on('join_match', (data) => {
    const { matchId } = data;
    const roomName = `match_${matchId}`;
    socket.join(roomName);
    console.log(`클라이언트 ${socket.id}가 경기 방 ${roomName}에 참여함 (join_match)`);
    
    // 방 참가 확인 이벤트 전송
    socket.emit('joined_room', { 
      roomName: roomName, 
      matchId: matchId,
      clientId: socket.id 
    });
    console.log(`✅ 방 참가 확인 이벤트 전송: ${roomName}`);
  });

  // 득점 정보 저장 이벤트 처리
  socket.on('saveGoals', async (data) => {
    try {
      const { matchId, homeGoals, awayGoals } = data;
      console.log(`=== 득점 정보 저장 요청 ===`);
      console.log(`경기 ID: ${matchId}`);
      console.log(`홈팀 득점:`, homeGoals);
      console.log(`어웨이팀 득점:`, awayGoals);
      
      const match = await Match.findByPk(matchId);
      if (!match) {
        console.error(`경기를 찾을 수 없음: ${matchId}`);
        socket.emit('goalsSaveError', { error: '경기를 찾을 수 없습니다.' });
        return;
      }
      
      // match_data에 득점 정보 저장
      let matchData = match.match_data || {};
      matchData.goals = {
        home: homeGoals || [],
        away: awayGoals || []
      };
      
      // Match.update() 메서드 사용하여 확실한 저장
      await Match.update(
        { match_data: matchData },
        { where: { id: matchId } }
      );
      console.log(`✅ 득점 정보 DB 저장 완료: ${matchId}`);
      
      // 성공 응답
      socket.emit('goalsSaved', { success: true, message: '득점 정보가 저장되었습니다.' });
      
    } catch (error) {
      console.error('득점 정보 저장 처리 중 오류 발생:', error);
      socket.emit('goalsSaveError', { error: '득점 정보 저장에 실패했습니다.' });
    }
  });

  // 득점 정보 로드 이벤트 처리
  socket.on('loadGoals', async (data) => {
    try {
      const { matchId } = data;
      console.log(`=== 득점 정보 로드 요청 ===`);
      console.log(`경기 ID: ${matchId}`);
      
      const match = await Match.findByPk(matchId);
      if (!match) {
        console.error(`경기를 찾을 수 없음: ${matchId}`);
        socket.emit('goalsLoaded', { goals: null });
        return;
      }
      
      const matchData = match.match_data || {};
      const goals = matchData.goals || { home: [], away: [] };
      
      console.log(`저장된 득점 정보:`, goals);
      socket.emit('goalsLoaded', { goals: goals });
      console.log(`✅ 득점 정보 로드 완료: ${matchId}`);
      
    } catch (error) {
      console.error('득점 정보 로드 처리 중 오류 발생:', error);
      socket.emit('goalsLoaded', { goals: null });
    }
  });

  // 경기 데이터 로드 이벤트 처리
  socket.on('loadMatchData', async (data) => {
    try {
      const { matchId } = data;
      console.log(`경기 데이터 로드 요청: matchId=${matchId}`);
      
      const match = await Match.findByPk(matchId);
      if (match) {
        socket.emit('matchDataLoaded', {
          home_score: match.home_score,
          away_score: match.away_score,
          home_team: match.home_team,
          away_team: match.away_team,
          home_team_color: match.home_team_color,
          away_team_color: match.away_team_color,
          status: match.status
        });
        console.log(`경기 데이터 로드 완료: matchId=${matchId}`);
      } else {
        socket.emit('matchDataLoaded', null);
        console.log(`경기를 찾을 수 없음: matchId=${matchId}`);
      }
    } catch (error) {
      console.error('경기 데이터 로드 처리 중 오류 발생:', error);
      socket.emit('matchDataLoaded', null);
    }
  });

  console.log('경기 이벤트 설정 완료:', socket.id);
};

module.exports = matchEvents;
