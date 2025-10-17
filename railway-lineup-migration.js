const { Client } = require('pg');

// Railway PostgreSQL에서 match_data에 lineup 필드 추가하는 마이그레이션 스크립트
async function addLineupToMatchData() {
  console.log('🚀 Railway PostgreSQL match_data에 lineup 필드 추가 시작...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
  }
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. 데이터베이스 연결
    console.log('🔗 Railway PostgreSQL 연결 중...');
    await client.connect();
    console.log('✅ Railway PostgreSQL 연결 성공');

    // 2. 모든 Matches 레코드 조회
    console.log('📊 Matches 테이블 조회 중...');
    const result = await client.query('SELECT id, sport_type, match_data FROM "Matches"');
    console.log(`✅ ${result.rows.length}개 경기 데이터 조회 완료`);

    let updatedCount = 0;

    // 3. 각 경기에 lineup 필드 추가
    for (const match of result.rows) {
      const { id, sport_type, match_data } = match;
      
      console.log(`🔧 경기 ${id} (${sport_type}) 처리 중...`);
      
      // match_data가 null이거나 undefined인 경우 빈 객체로 초기화
      let updatedMatchData = match_data || {};
      
      // lineup 필드가 없는 경우에만 추가
      if (!updatedMatchData.lineup) {
        updatedMatchData.lineup = {
          home: [],
          away: []
        };
        
        console.log(`  ✅ lineup 필드 추가: ${id}`);
        
        // 4. 업데이트된 match_data 저장
        await client.query(
          'UPDATE "Matches" SET match_data = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(updatedMatchData), id]
        );
        
        console.log(`  💾 경기 ${id} 업데이트 완료`);
        updatedCount++;
      } else {
        console.log(`  ⏭️ lineup 필드 이미 존재: ${id}`);
      }
    }

    console.log('🎉 Railway PostgreSQL match_data lineup 필드 추가 완료!');
    console.log(`📋 ${updatedCount}개 경기에 lineup 필드가 추가되었습니다.`);

    // 5. 결과 확인
    console.log('🔍 업데이트 결과 확인 중...');
    const verifyResult = await client.query('SELECT id, match_data FROM "Matches" LIMIT 3');
    verifyResult.rows.forEach(match => {
      const hasLineup = match.match_data && match.match_data.lineup;
      console.log(`  경기 ${match.id}: lineup 필드 ${hasLineup ? '존재' : '없음'}`);
    });

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Railway PostgreSQL 연결 종료');
  }
}

// Railway 환경에서 실행
if (require.main === module) {
  addLineupToMatchData()
    .then(() => {
      console.log('✅ Railway PostgreSQL lineup 필드 추가 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Railway PostgreSQL lineup 필드 추가 실패:', error);
      process.exit(1);
    });
}

module.exports = { addLineupToMatchData };
