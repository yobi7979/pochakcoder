#!/usr/bin/env node

/**
 * Railway PostgreSQL 배구 스키마 업데이트 스크립트
 * 
 * 이 스크립트는 배구 경기 데이터 구조를 올바르게 수정합니다:
 * - home_score/away_score: 토탈 세트 승리 수 저장
 * - match_data: 현재 세트 점수 및 배구 전용 데이터 저장
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Railway 환경에서만 실행
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('postgres')) {
  console.log('❌ 이 스크립트는 Railway PostgreSQL 환경에서만 실행됩니다.');
  console.log('현재 DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '없음');
  process.exit(1);
}

// Sequelize 연결 설정
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  timezone: '+09:00',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function updateVolleyballSchema() {
  console.log('🚀 Railway PostgreSQL 배구 스키마 업데이트 시작...');
  
  try {
    // 1. 연결 테스트
    await sequelize.authenticate();
    console.log('✅ PostgreSQL 연결 성공');

    // 2. 기존 배구 경기 데이터 확인
    console.log('\n📊 기존 배구 경기 데이터 확인...');
    const [volleyballMatches] = await sequelize.query(`
      SELECT id, home_score, away_score, status, match_data 
      FROM "Matches" 
      WHERE sport_type = 'VOLLEYBALL' 
      ORDER BY updated_at DESC 
      LIMIT 5
    `);
    
    console.log(`발견된 배구 경기 수: ${volleyballMatches.length}`);
    volleyballMatches.forEach((match, index) => {
      console.log(`\n--- 경기 ${index + 1} ---`);
      console.log(`ID: ${match.id}`);
      console.log(`홈팀 점수 (토탈): ${match.home_score}`);
      console.log(`어웨이팀 점수 (토탈): ${match.away_score}`);
      console.log(`상태: ${match.status}`);
      console.log(`match_data: ${JSON.stringify(match.match_data, null, 2)}`);
    });

    // 3. 배구 경기 데이터 구조 수정
    console.log('\n🔧 배구 경기 데이터 구조 수정 시작...');
    
    for (const match of volleyballMatches) {
      const matchData = match.match_data || {};
      
      // 현재 세트 점수를 match_data로 이동 (아직 저장되지 않은 경우)
      if (matchData.home_score === undefined && matchData.away_score === undefined) {
        console.log(`\n경기 ${match.id} 데이터 구조 수정 중...`);
        
        // 기본 배구 데이터 구조 설정
        const updatedMatchData = {
          ...matchData,
          setFormat: matchData.setFormat || 3,  // 기본 3세트제
          current_set: matchData.current_set || 1,
          home_score: 0,  // 현재 세트 점수 초기화
          away_score: 0,  // 현재 세트 점수 초기화
          set_scores: matchData.set_scores || { home: {}, away: {} },
          home_wins: matchData.home_wins || 0,
          away_wins: matchData.away_wins || 0,
          servingTeam: matchData.servingTeam || 'home',
          state: match.status || '1세트'
        };
        
        // 토탈 세트 승리 수는 home_score/away_score에 유지
        // (이미 올바르게 저장되어 있다고 가정)
        
        // 데이터베이스 업데이트
        await sequelize.query(`
          UPDATE "Matches" 
          SET match_data = :matchData, 
              updated_at = NOW()
          WHERE id = :matchId
        `, {
          replacements: {
            matchData: JSON.stringify(updatedMatchData),
            matchId: match.id
          }
        });
        
        console.log(`✅ 경기 ${match.id} 데이터 구조 수정 완료`);
      } else {
        console.log(`⏭️ 경기 ${match.id}는 이미 올바른 구조입니다.`);
      }
    }

    // 4. 수정된 데이터 확인
    console.log('\n📋 수정된 배구 경기 데이터 확인...');
    const [updatedMatches] = await sequelize.query(`
      SELECT id, home_score, away_score, status, match_data 
      FROM "Matches" 
      WHERE sport_type = 'VOLLEYBALL' 
      ORDER BY updated_at DESC 
      LIMIT 3
    `);
    
    updatedMatches.forEach((match, index) => {
      console.log(`\n--- 수정된 경기 ${index + 1} ---`);
      console.log(`ID: ${match.id}`);
      console.log(`홈팀 토탈 세트 승리 수: ${match.home_score}`);
      console.log(`어웨이팀 토탈 세트 승리 수: ${match.away_score}`);
      console.log(`현재 세트 점수: ${match.match_data?.home_score || 0} - ${match.match_data?.away_score || 0}`);
      console.log(`세트제: ${match.match_data?.setFormat || 3}세트제`);
      console.log(`현재 세트: ${match.match_data?.current_set || 1}세트`);
      console.log(`서브권: ${match.match_data?.servingTeam || 'home'}`);
    });

    // 5. 인덱스 최적화 (선택사항)
    console.log('\n🔍 인덱스 최적화 확인...');
    try {
      // sport_type에 대한 인덱스가 있는지 확인
      const [indexes] = await sequelize.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'Matches' 
        AND indexname LIKE '%sport_type%'
      `);
      
      if (indexes.length === 0) {
        console.log('📈 sport_type 인덱스 생성 중...');
        await sequelize.query(`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_sport_type 
          ON "Matches" (sport_type)
        `);
        console.log('✅ sport_type 인덱스 생성 완료');
      } else {
        console.log('✅ sport_type 인덱스가 이미 존재합니다.');
      }
    } catch (indexError) {
      console.log('⚠️ 인덱스 생성 중 오류 (무시 가능):', indexError.message);
    }

    console.log('\n🎉 Railway PostgreSQL 배구 스키마 업데이트 완료!');
    console.log('\n📋 수정 사항 요약:');
    console.log('- home_score/away_score: 토탈 세트 승리 수 저장');
    console.log('- match_data.home_score/away_score: 현재 세트 점수 저장');
    console.log('- match_data.setFormat: 세트제 정보 저장');
    console.log('- match_data.set_scores: 각 세트별 점수 저장');
    console.log('- match_data.servingTeam: 서브권 정보 저장');

  } catch (error) {
    console.error('❌ 스키마 업데이트 중 오류 발생:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  updateVolleyballSchema()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { updateVolleyballSchema };
