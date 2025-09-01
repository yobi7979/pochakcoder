const io = require('socket.io-client');

// 서버 URL
const SERVER_URL = 'http://localhost:3000';

// 모든 경기를 리셋하는 함수
async function resetAllMatches() {
    try {
        console.log('🔄 모든 경기 리셋 시작...');
        
        // 1. 경기 목록 가져오기
        const response = await fetch(`${SERVER_URL}/api/matches`);
        const matches = await response.json();
        
        console.log(`📋 총 ${matches.length}개의 경기를 찾았습니다.`);
        
        // 2. 각 경기 리셋
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            
            console.log(`\n🎯 경기 ${i + 1}/${matches.length}: ${match.home_team} vs ${match.away_team}`);
            
            // 소켓 연결
            const socket = io(SERVER_URL);
            
            // 경기 방에 참가
            socket.emit('join_match', { matchId: match.id });
            
            // 타이머 정지
            socket.emit('timer_control', {
                matchId: match.id,
                action: 'stop'
            });
            
            // 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 타이머 리셋 (0분 0초)
            socket.emit('timer_control', {
                matchId: match.id,
                action: 'reset'
            });
            
            // 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 점수 리셋 (0:0) - 여러 방법으로 시도
            socket.emit('score_update', {
                matchId: match.id,
                home_score: 0,
                away_score: 0
            });
            
            // 추가로 match_update 이벤트로도 점수 리셋
            socket.emit('match_update', {
                matchId: match.id,
                home_score: 0,
                away_score: 0
            });
            
            // 경기 데이터 업데이트로도 점수 리셋
            socket.emit('update_match_data', {
                matchId: match.id,
                home_score: 0,
                away_score: 0
            });
            
            console.log(`   ✅ 타이머 정지 및 점수 리셋 완료`);
            
            // 소켓 연결 정리
            setTimeout(() => {
                socket.disconnect();
            }, 1000);
            
            // 다음 경기까지 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('\n🎉 모든 경기 리셋 완료!');
        console.log(`📊 총 ${matches.length}개 경기가 리셋되었습니다.`);
        console.log('   - 모든 타이머가 정지되었습니다');
        console.log('   - 모든 점수가 0:0으로 리셋되었습니다');
        console.log('   - 모든 시간이 0분 0초로 리셋되었습니다');
        
        // 3. 성능 모니터링 정보 출력
        setTimeout(async () => {
            try {
                const perfResponse = await fetch(`${SERVER_URL}/api/performance`);
                const perfData = await perfResponse.json();
                console.log('\n📈 성능 모니터링:');
                console.log(`   활성 경기: ${perfData.activeMatches}`);
                console.log(`   활성 연결: ${perfData.activeConnections}`);
                console.log(`   메모리 사용량: ${perfData.memoryUsage?.heapUsed || 'N/A'}`);
            } catch (error) {
                console.log('   성능 모니터링 정보를 가져올 수 없습니다.');
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    }
}

// 스크립트 실행
if (require.main === module) {
    resetAllMatches();
}

module.exports = { resetAllMatches }; 