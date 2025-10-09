// SportsCoder WebSocket 팀 관련 이벤트 처리
const { Match } = require('../../models');

/**
 * 팀 관련 WebSocket 이벤트 설정
 * @param {Object} socket - Socket.IO 소켓 인스턴스
 * @param {Object} io - Socket.IO 인스턴스
 */
const teamEvents = (socket, io) => {
  console.log('팀 이벤트 설정 시작:', socket.id);

  // 팀 색상 업데이트 이벤트 처리
  socket.on('updateTeamColor', async (data) => {
    try {
      const { matchId, teamType, teamColor, headerText, sportType } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`팀 색상 업데이트: matchId=${matchId}, teamType=${teamType}, color=${teamColor}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (!match) {
        socket.emit('teamColorUpdated', { success: false, error: '경기를 찾을 수 없습니다.' });
        return;
      }
      
      // 팀 컬러 업데이트 (기존 server.js와 동일)
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
      
      // TeamInfo 테이블도 업데이트 (DB 관리 페이지와 동기화)
      const { sequelize } = require('../../models');
      await sequelize.query(`
        UPDATE TeamInfo 
        SET team_color = ?, team_header = ?, updated_at = CURRENT_TIMESTAMP
        WHERE match_id = ? AND team_type = ?
      `, {
        replacements: [teamColor, headerText || (teamType === 'home' ? match.home_team_header : match.away_team_header), matchId, teamType],
        type: sequelize.QueryTypes.UPDATE
      });
      
      console.log(`TeamInfo 테이블 동기화 완료: matchId=${matchId}, teamType=${teamType}`);
      
      // 즉시 반영을 위한 전체 색상 정보 전송
      io.to(roomName).emit('teamColorChanged', {
        matchId: matchId,
        homeColor: teamType === 'home' ? teamColor : match.home_team_color,
        awayColor: teamType === 'away' ? teamColor : match.away_team_color
      });
      
      // 성공 응답 전송
      socket.emit('teamColorUpdated', { success: true });
      
      console.log(`팀 색상 업데이트 완료: matchId=${matchId}`);
    } catch (error) {
      console.error('팀 색상 업데이트 처리 중 오류 발생:', error);
      socket.emit('teamColorUpdated', { success: false, error: '팀 색상 업데이트에 실패했습니다.' });
    }
  });

  // 팀 헤더 업데이트 이벤트 처리
  socket.on('updateTeamHeader', async (data) => {
    try {
      const { matchId, teamType, headerText } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`팀 헤더 업데이트: matchId=${matchId}, teamType=${teamType}, header=${headerText}`);
      
      // 해당 방의 모든 클라이언트에게 팀 헤더 업데이트 이벤트 전송
      io.to(roomName).emit('team_header_updated', {
        matchId: matchId,
        teamType: teamType,
        headerText: headerText
      });
      
      console.log(`팀 헤더 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('팀 헤더 업데이트 처리 중 오류 발생:', error);
      socket.emit('team_header_update_error', { error: '팀 헤더 업데이트에 실패했습니다.' });
    }
  });

  // 팀 이름 업데이트 이벤트 처리
  socket.on('updateTeamName', async (data) => {
    try {
      const { matchId, team, teamName } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`팀 이름 업데이트: matchId=${matchId}, team=${team}, name=${teamName}`);
      
      // DB 업데이트
      const match = await Match.findByPk(matchId);
      if (match) {
        if (team === 'home') {
          await match.update({ home_team: teamName });
        } else if (team === 'away') {
          await match.update({ away_team: teamName });
        }
        console.log(`팀 이름 업데이트 완료: matchId=${matchId}`);
      }
      
      // 해당 방의 모든 클라이언트에게 팀 이름 업데이트 이벤트 전송
      io.to(roomName).emit('teamNameUpdated', {
        matchId: matchId,
        team: team,
        teamName: teamName
      });
      
      console.log(`팀 이름 업데이트 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('팀 이름 업데이트 처리 중 오류 발생:', error);
      socket.emit('team_name_update_error', { error: '팀 이름 업데이트에 실패했습니다.' });
    }
  });

  // 팀 로고 업데이트 이벤트 처리
  socket.on('teamLogoUpdated', async (data) => {
    try {
      const { matchId, teamType, path: logoPath, bgColor: logoBgColor, teamName } = data;
      const roomName = `match_${matchId}`;
      const match = await Match.findByPk(matchId);
      
      console.log(`팀 로고 업데이트: matchId=${matchId}, teamType=${teamType}, path=${logoPath}`);
      
      if (!match) {
        socket.emit('teamLogoUpdated', {
          matchId: data.matchId,
          teamType: data.teamType,
          teamName: data.teamName,
          success: false,
          error: '경기를 찾을 수 없습니다.'
        });
        return;
      }

      // 1. 매치 데이터 업데이트 (기존 server.js와 동일)
      const matchData = { ...match.match_data } || {};
      matchData[`${teamType}_team_logo`] = logoPath;
      matchData[`${teamType}_team_bg_color`] = logoBgColor;
      
      await match.update({ match_data: matchData });

      // 데이터베이스 전용 접근 방식 - JSON 파일 의존성 제거
      console.log('데이터베이스 전용 팀 로고 관리 시스템 사용');

      // 3. 소켓 이벤트 발생 (기존 server.js와 동일)
      io.to(roomName).emit('teamLogoUpdated', {
        matchId,
        teamType,
        path: logoPath,
        bgColor: logoBgColor,
        teamName,
        success: true
      });
      
      console.log(`팀 로고 업데이트 완료: matchId=${matchId}`);
    } catch (error) {
      console.error('팀 로고 업데이트 처리 중 오류 발생:', error);
      socket.emit('teamLogoUpdated', {
        matchId: data.matchId,
        teamType: data.teamType,
        teamName: data.teamName,
        success: false,
        error: '팀 로고 업데이트에 실패했습니다.'
      });
    }
  });

  // 야구 팀 로고 업데이트 이벤트 처리
  socket.on('baseballTeamLogoUpdated', (data) => {
    const { matchId, teamType, path, bgColor, teamColor } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`야구 팀 로고 업데이트: matchId=${matchId}, teamType=${teamType}, path=${path}`);
    
    // 해당 방의 모든 클라이언트에게 야구 팀 로고 업데이트 이벤트 전송
    io.to(roomName).emit('baseball_team_logo_updated', {
      matchId: matchId,
      teamType: teamType,
      path: path,
      bgColor: bgColor,
      teamColor: teamColor
    });
    
    console.log(`야구 팀 로고 업데이트 이벤트를 방 ${roomName}에 전송함`);
  });

  // 로고 표시 토글 이벤트 처리
  socket.on('toggle-logo-display', async (data) => {
    try {
      const { matchId, teamType, showLogo } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`로고 표시 토글: matchId=${matchId}, teamType=${teamType}, show=${showLogo}`);
      
      // 해당 방의 모든 클라이언트에게 로고 표시 토글 이벤트 전송
      io.to(roomName).emit('logo-display-toggled', {
        matchId: matchId,
        teamType: teamType,
        showLogo: showLogo
      });
      
      console.log(`로고 표시 토글 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('로고 표시 토글 처리 중 오류 발생:', error);
      socket.emit('logo_display_toggle_error', { error: '로고 표시 토글에 실패했습니다.' });
    }
  });

  // 팀 로고 가시성 변경 이벤트 처리
  socket.on('teamLogoVisibilityChanged', (data) => {
    const { matchId, useLogos } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`팀 로고 가시성 변경: matchId=${matchId}, useLogos=${useLogos}`);
    
    // 해당 방의 모든 클라이언트에게 팀 로고 가시성 변경 이벤트 전송
    io.to(roomName).emit('teamLogoVisibilityChanged', {
      matchId: matchId,
      useLogos: useLogos
    });
    
    console.log(`팀 로고 가시성 변경 이벤트를 방 ${roomName}에 전송함`);
  });

  // 팀 로고 표시 모드 변경 이벤트 처리
  socket.on('teamLogoDisplayModeChanged', (data) => {
    const { matchId, displayMode } = data;
    const roomName = `match_${matchId}`;
    
    console.log(`팀 로고 표시 모드 변경: matchId=${matchId}, displayMode=${displayMode}`);
    
    // 해당 방의 모든 클라이언트에게 팀 로고 표시 모드 변경 이벤트 전송
    io.to(roomName).emit('teamLogoDisplayModeChanged', {
      matchId: matchId,
      displayMode: displayMode
    });
    
    console.log(`팀 로고 표시 모드 변경 이벤트를 방 ${roomName}에 전송함`);
  });

  // 팀 로고 제거 이벤트 처리
  socket.on('removeTeamLogo', async (data) => {
    try {
      const { matchId, teamType, teamName } = data;
      const roomName = `match_${matchId}`;
      
      console.log(`팀 로고 제거: matchId=${matchId}, teamType=${teamType}, teamName=${teamName}`);
      
      // 해당 방의 모든 클라이언트에게 팀 로고 제거 이벤트 전송
      io.to(roomName).emit('team_logo_removed', {
        matchId: matchId,
        teamType: teamType,
        teamName: teamName
      });
      
      console.log(`팀 로고 제거 이벤트를 방 ${roomName}에 전송함`);
    } catch (error) {
      console.error('팀 로고 제거 처리 중 오류 발생:', error);
      socket.emit('team_logo_remove_error', { error: '팀 로고 제거에 실패했습니다.' });
    }
  });

  console.log('팀 이벤트 설정 완료:', socket.id);
};

module.exports = teamEvents;
