const io = require('socket.io-client');
const { exec } = require('child_process');
const path = require('path');

// 서버 URL
const SERVER_URL = 'http://localhost:3000';

// 모든 경기의 타이머를 시작하고 26개의 통합 오버레이 페이지를 여는 함수
async function startAllMatches() {
    try {
        console.log('🚀 모든 경기 타이머 시작 및 26개 통합 오버레이 페이지 열기 시작...');
        
        // 1. 경기 목록 가져오기
        const response = await fetch(`${SERVER_URL}/api/matches`);
        const matches = await response.json();
        
        console.log(`📋 총 ${matches.length}개의 경기를 찾았습니다.`);
        
        // 2. 모든 경기의 타이머 시작
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            console.log(`\n🎯 경기 ${i + 1}/${matches.length}: ${match.home_team} vs ${match.away_team}`);
            
            // 소켓 연결
            const socket = io(SERVER_URL);
            
            // 경기 방에 참가
            socket.emit('join_match', { matchId: match.id });
            
            // 타이머 시작
            socket.emit('timer_control', {
                matchId: match.id,
                action: 'start'
            });
            
            console.log(`   ✅ 타이머 시작됨`);
            
            // 소켓 연결 정리
            setTimeout(() => {
                socket.disconnect();
            }, 5000);
        }
        
        console.log('\n🎉 모든 경기 타이머 시작 완료!');
        
        // 3. 26개의 통합 오버레이 페이지 열기
        console.log('\n🌐 26개의 통합 오버레이 페이지 열기 시작...');
        for (let i = 1; i <= 26; i++) {
            setTimeout(() => {
                const overlayUrl = `${SERVER_URL}/unified/${i}/overlay`;
                
                exec(`start ${overlayUrl}`, (error) => {
                    if (error) {
                        console.error(`   ❌ 통합 오버레이 페이지 ${i} 열기 실패: ${error.message}`);
                    } else {
                        console.log(`   🌐 통합 오버레이 페이지 ${i} 열림: ${overlayUrl}`);
                    }
                });
            }, i * 500); // 0.5초씩 지연
        }
        
        console.log('\n🎉 모든 설정 완료!');
        console.log(`📊 총 ${matches.length}개 경기 타이머 시작, 26개 통합 오버레이 페이지 열림`);
        
        // 4. 성능 모니터링 정보 출력
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
        }, 15000);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    }
}

// 스크립트 실행
if (require.main === module) {
    startAllMatches();
}

module.exports = { startAllMatches }; 