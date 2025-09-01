const io = require('socket.io-client');

// 서버 URL
const SERVER_URL = 'http://localhost:3000';

// 랜덤 시간 생성 함수 (0분~90분 사이)
function getRandomTime() {
    const minutes = Math.floor(Math.random() * 91); // 0~90분
    const seconds = Math.floor(Math.random() * 60); // 0~59초
    return { minutes, seconds };
}

// 랜덤 시간을 경기에 적용하는 함수
async function randomizeMatchTimes() {
    try {
        console.log('🎲 경기 시간 랜덤 설정 시작...');
        
        // 1. 경기 목록 가져오기
        const response = await fetch(`${SERVER_URL}/api/matches`);
        const matches = await response.json();
        
        console.log(`📋 총 ${matches.length}개의 경기를 찾았습니다.`);
        
        // 2. 각 경기에 랜덤 시간 적용
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const { minutes, seconds } = getRandomTime();
            
            console.log(`\n🎯 경기 ${i + 1}/${matches.length}: ${match.home_team} vs ${match.away_team}`);
            console.log(`   ⏰ 랜덤 시간 설정: ${minutes}분 ${seconds}초`);
            
            // 소켓 연결
            const socket = io(SERVER_URL);
            
            // 경기 방에 참가
            socket.emit('join_match', { matchId: match.id });
            
            // 타이머 정지 (기존 타이머가 있다면)
            socket.emit('timer_control', {
                matchId: match.id,
                action: 'stop'
            });
            
            // 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 랜덤 시간으로 타이머 설정
            socket.emit('timer_control', {
                matchId: match.id,
                action: 'set',
                minutes: minutes,
                seconds: seconds
            });
            
            console.log(`   ✅ 시간 설정 완료`);
            
            // 소켓 연결 정리
            setTimeout(() => {
                socket.disconnect();
            }, 1000);
            
            // 다음 경기까지 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('\n🎉 모든 경기 시간 랜덤 설정 완료!');
        console.log(`📊 총 ${matches.length}개 경기의 시간이 랜덤하게 설정되었습니다.`);
        
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
    randomizeMatchTimes();
}

module.exports = { randomizeMatchTimes, getRandomTime }; 