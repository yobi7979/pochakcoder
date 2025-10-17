# Railway DB 라인업 저장 확인 가이드

## 🔍 **Railway DB 확인 방법**

### 1️⃣ **Railway 대시보드에서 확인**

1. **Railway 대시보드 접속**: https://railway.app
2. **프로젝트 선택**: SportsCoder 프로젝트
3. **서비스 선택**: 웹 서비스
4. **Deployments 탭**: 최신 배포 확인
5. **Logs 탭**: 서버 로그 확인

### 2️⃣ **라인업 저장 테스트**

#### **컨트롤 페이지에서 테스트:**
1. **축구 컨트롤 페이지 접속**
2. **라인업 관리 섹션에서 입력:**
   ```
   1 이승엽 GK
   2 김철수 DF
   3 박민수 MF
   4 정우진 FW
   ```
3. **"홈팀 라인업 저장" 버튼 클릭**
4. **Railway 로그에서 확인:**
   ```
   🔍 저장 전 match_data: {...}
   🔍 lineup 초기화: { home: [], away: [] }
   🔍 업데이트 후 match_data: {...}
   🔍 저장 후 확인: {...}
   ```

### 3️⃣ **Railway 로그에서 확인할 내용**

#### **라인업 저장 성공 시:**
```
홈팀 라인업 저장: 10168125
🔍 저장 전 match_data: {
  "home_team_color": "#1e40af",
  "away_team_color": "#1e40af",
  "home_team_header": "원정팀입니다",
  "away_team_header": "홈팀입니다",
  "use_team_logos": false,
  "timer_startTime": 1760662815650,
  "timer_pausedTime": 0,
  "timer_isRunning": true,
  "timer_lastUpdate": 1760662815650
}
🔍 lineup 초기화: { home: [], away: [] }
🔍 업데이트 후 match_data: {
  "home_team_color": "#1e40af",
  "away_team_color": "#1e40af",
  "home_team_header": "원정팀입니다",
  "away_team_header": "홈팀입니다",
  "use_team_logos": false,
  "timer_startTime": 1760662815650,
  "timer_pausedTime": 0,
  "timer_isRunning": true,
  "timer_lastUpdate": 1760662815650,
  "lineup": {
    "home": [
      { "number": "1", "name": "이승엽", "position": "GK" },
      { "number": "2", "name": "김철수", "position": "DF" },
      { "number": "3", "name": "박민수", "position": "MF" },
      { "number": "4", "name": "정우진", "position": "FW" }
    ],
    "away": []
  }
}
🔍 저장 후 확인: {...}
홈팀 라인업 저장 완료: 10168125
```

### 4️⃣ **오버레이 페이지에서 확인**

1. **축구 오버레이 페이지 접속**
2. **L키를 눌러서 라인업 표시**
3. **라인업이 정상적으로 표시되는지 확인**

### 5️⃣ **문제 해결**

#### **라인업이 저장되지 않는 경우:**
1. **Railway 로그 확인**: 에러 메시지 확인
2. **API 엔드포인트 확인**: `/api/matches/:matchId/save-lineup`
3. **DB 연결 확인**: PostgreSQL 연결 상태
4. **권한 확인**: DB 쓰기 권한

#### **라인업이 표시되지 않는 경우:**
1. **오버레이 페이지 새로고침**
2. **L키로 라인업 토글**
3. **브라우저 개발자 도구 콘솔 확인**

### 6️⃣ **확인 체크리스트**

- [ ] Railway 서버가 실행 중인가?
- [ ] 라인업 저장 API가 호출되는가?
- [ ] DB에 라인업 데이터가 저장되는가?
- [ ] 오버레이 페이지에서 라인업이 표시되는가?
- [ ] 실시간 업데이트가 작동하는가?

## 🎯 **결론**

**Railway DB에서 라인업 저장을 확인하려면:**

1. **Railway 대시보드에서 로그 확인**
2. **컨트롤 페이지에서 라인업 저장 테스트**
3. **오버레이 페이지에서 라인업 표시 확인**
4. **실시간 업데이트 테스트**

**모든 단계가 정상적으로 작동하면 Railway DB에 라인업이 성공적으로 저장된 것입니다.**
