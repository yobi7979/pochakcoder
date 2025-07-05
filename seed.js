const { Match } = require('./models');

async function seedDatabase() {
  try {
    // 기존 경기 데이터 확인
    const existingMatches = await Match.findAll();
    
    if (existingMatches.length > 0) {
      console.log('이미 경기 데이터가 있습니다. 시드 작업을 건너뜁니다.');
      return;
    }
    
    // 축구 팀 데이터
    const soccerTeams = [
      { name: '서울 FC', header: '서울', color: '#1d4ed8' },
      { name: '부산 유나이티드', header: '부산', color: '#dc2626' },
      { name: '인천 유나이티드', header: '인천', color: '#0891b2' },
      { name: '전북 현대', header: '전북', color: '#15803d' },
      { name: '울산 현대', header: '울산', color: '#0369a1' },
      { name: '수원 삼성', header: '수원', color: '#4338ca' },
      { name: '성남 FC', header: '성남', color: '#7c2d12' },
      { name: '대구 FC', header: '대구', color: '#1e40af' },
      { name: '광주 FC', header: '광주', color: '#fbbf24' },
      { name: '포항 스틸러스', header: '포항', color: '#b91c1c' }
    ];
    
    // 야구 팀 데이터
    const baseballTeams = [
      { name: '두산 베어스', header: '두산', color: '#1e3a8a' },
      { name: '삼성 라이온즈', header: '삼성', color: '#1e40af' },
      { name: 'KT 위즈', header: 'KT', color: '#b91c1c' },
      { name: 'NC 다이노스', header: 'NC', color: '#0c4a6e' },
      { name: '기아 타이거즈', header: '기아', color: '#b45309' },
      { name: 'LG 트윈스', header: 'LG', color: '#4338ca' },
      { name: '롯데 자이언츠', header: '롯데', color: '#065f46' },
      { name: 'SSG 랜더스', header: 'SSG', color: '#b91c1c' },
      { name: '한화 이글스', header: '한화', color: '#fbbf24' },
      { name: '키움 히어로즈', header: '키움', color: '#9f1239' }
    ];
    
    // 축구 경기 50개 생성
    console.log('축구 경기 생성 중...');
    for (let i = 0; i < 50; i++) {
      const homeIndex = Math.floor(Math.random() * soccerTeams.length);
      let awayIndex;
      do {
        awayIndex = Math.floor(Math.random() * soccerTeams.length);
      } while (homeIndex === awayIndex);
      
      const homeTeam = soccerTeams[homeIndex];
      const awayTeam = soccerTeams[awayIndex];
      
      await Match.create({
        sport_type: 'soccer',
        home_team: homeTeam.name,
        away_team: awayTeam.name,
        home_team_color: homeTeam.color,
        away_team_color: awayTeam.color,
        home_team_header: homeTeam.header,
        away_team_header: awayTeam.header,
        home_score: Math.floor(Math.random() * 5),
        away_score: Math.floor(Math.random() * 5),
        status: ['pending', 'active', 'completed'][Math.floor(Math.random() * 3)]
      });
      
      if ((i + 1) % 10 === 0) {
        console.log(`축구 경기 ${i + 1}개 생성 완료`);
      }
    }
    
    // 야구 경기 50개 생성
    console.log('야구 경기 생성 중...');
    for (let i = 0; i < 50; i++) {
      const homeIndex = Math.floor(Math.random() * baseballTeams.length);
      let awayIndex;
      do {
        awayIndex = Math.floor(Math.random() * baseballTeams.length);
      } while (homeIndex === awayIndex);
      
      const homeTeam = baseballTeams[homeIndex];
      const awayTeam = baseballTeams[awayIndex];
      
      await Match.create({
        sport_type: 'baseball',
        home_team: homeTeam.name,
        away_team: awayTeam.name,
        home_team_color: homeTeam.color,
        away_team_color: awayTeam.color,
        home_team_header: homeTeam.header,
        away_team_header: awayTeam.header,
        home_score: Math.floor(Math.random() * 10),
        away_score: Math.floor(Math.random() * 10),
        status: ['pending', 'active', 'completed'][Math.floor(Math.random() * 3)]
      });
      
      if ((i + 1) % 10 === 0) {
        console.log(`야구 경기 ${i + 1}개 생성 완료`);
      }
    }
    
    console.log('총 100개의 샘플 경기 데이터 생성 완료');
  } catch (error) {
    console.error('샘플 데이터 생성 중 오류 발생:', error);
  }
}

// 시드 스크립트 실행
seedDatabase()
  .then(() => {
    console.log('시드 스크립트 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('시드 스크립트 실행 중 오류 발생:', error);
    process.exit(1);
  }); 