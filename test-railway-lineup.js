// Railway 환경에서 라인업 저장 테스트 스크립트
const { Match } = require('./models');

async function testRailwayLineupSave() {
  try {
    console.log('🚨 Railway 라인업 저장 테스트 시작');
    
    // 환경 변수 확인
    console.log('🔍 환경 변수 확인:');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '없음');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
    
    // 데이터베이스 연결 확인
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 기존 경기 조회
    const existingMatch = await Match.findOne({
      where: { id: '10168125' }
    });
    
    if (!existingMatch) {
      console.log('❌ 테스트용 경기를 찾을 수 없습니다. ID: 10168125');
      return;
    }
    
    console.log('🔍 기존 경기 데이터:', {
      id: existingMatch.id,
      sport_type: existingMatch.sport_type,
      home_team: existingMatch.home_team,
      away_team: existingMatch.away_team,
      match_data: existingMatch.match_data
    });
    
    // 라인업 데이터 생성
    const lineupData = {
      home: [
        { number: "1", name: "이승엽", position: "GK" },
        { number: "2", name: "김철수", position: "DF" },
        { number: "3", name: "박민수", position: "MF" },
        { number: "4", name: "정우진", position: "FW" }
      ],
      away: [
        { number: "1", name: "김골키", position: "GK" },
        { number: "2", name: "이수비", position: "DF" },
        { number: "3", name: "박미드", position: "MF" },
        { number: "4", name: "정공격", position: "FW" }
      ]
    };
    
    // match_data에 라인업 저장
    const matchData = existingMatch.match_data || {};
    matchData.lineup = lineupData;
    
    console.log('🚨 저장할 라인업 데이터:', JSON.stringify(lineupData, null, 2));
    console.log('🚨 저장할 match_data:', JSON.stringify(matchData, null, 2));
    
    // 데이터베이스 업데이트
    await existingMatch.update({ match_data: matchData });
    
    // 저장 후 확인
    const updatedMatch = await Match.findByPk('10168125');
    console.log('✅ 라인업 저장 완료');
    console.log('🔍 저장된 match_data:', JSON.stringify(updatedMatch.match_data, null, 2));
    
    // 라인업 데이터 확인
    if (updatedMatch.match_data && updatedMatch.match_data.lineup) {
      console.log('✅ 라인업 데이터가 정상적으로 저장되었습니다.');
      console.log('홈팀 라인업:', updatedMatch.match_data.lineup.home);
      console.log('어웨이팀 라인업:', updatedMatch.match_data.lineup.away);
    } else {
      console.log('❌ 라인업 데이터가 저장되지 않았습니다.');
    }
    
  } catch (error) {
    console.error('❌ Railway 라인업 저장 테스트 실패:', error);
  } finally {
    process.exit(0);
  }
}

// Railway 환경에서만 실행
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
  console.log('🚀 Railway PostgreSQL 환경 감지 - 라인업 저장 테스트 시작');
  testRailwayLineupSave();
} else {
  console.log('ℹ️ 로컬 환경 - Railway 테스트 건너뜀');
  console.log('💡 Railway 환경에서 테스트하려면 DATABASE_URL을 설정하세요.');
}
