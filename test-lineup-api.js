const fetch = require('node-fetch');

async function testLineupAPI() {
    try {
        console.log('🧪 라인업 API 테스트 시작...');
        
        const testData = {
            teamType: 'home',
            lineup: [
                { number: '1', name: '테스트', position: 'GK' },
                { number: '2', name: '테스트2', position: 'DF' }
            ]
        };
        
        console.log('📤 전송할 데이터:', JSON.stringify(testData, null, 2));
        
        const response = await fetch('http://localhost:3000/api/matches/10168125/save-lineup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        console.log('📥 응답 결과:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ 라인업 저장 성공!');
        } else {
            console.log('❌ 라인업 저장 실패:', result.error);
        }
        
    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error);
    }
}

testLineupAPI();
