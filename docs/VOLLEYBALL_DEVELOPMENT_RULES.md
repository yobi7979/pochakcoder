# 🏐 배구 기본종목 추가 개발 룰

## 📋 룰 개요
배구 기본종목 추가 작업 시 반드시 참고해야 하는 개발 룰입니다. 이 룰을 준수하여 일관성 있고 안전한 개발을 진행합니다.

## 🚨 필수 참고 문서
**배구 기본종목 추가 작업 시 다음 문서를 반드시 참고하세요:**

1. **🏐 VOLLEYBALL_SPORT_ADDITION_PLAN.md** - 배구 기본종목 추가 계획서 (최우선)
2. **🚨 라우터 우선 확인** - API 추가/수정 시 해당 라우터 파일 먼저 확인
3. **JAVASCRIPT_FILES_REFERENCE.md** - 파일 작업 시 최우선
4. **API_REFERENCE.md** - API 관련 작업 시 최우선
5. **PROJECT_STRUCTURE.md** - 구조 변경 시 최우선

## 🎯 배구 기본종목 추가 목표
- 배구를 기본종목으로 추가 (SOCCER, BASEBALL과 동일한 레벨)
- 축구 템플릿을 기반으로 한 배구 전용 템플릿 생성
- **타이머 기능 완전 제거** (배구는 타이머가 필요 없음)
- 기존 시스템과의 호환성 유지

## 🏗️ 구현 단계별 룰

### 1단계: 데이터베이스 및 서버 설정
#### 1.1 기본종목 데이터 추가
- `server.js`의 기본종목 생성 로직에 배구 추가
- 종목 코드: `VOLLEYBALL`
- 템플릿: `volleyball`
- 활성화: `true`
- 기본종목: `true`

#### 1.2 서버 시작 시 자동 생성
```javascript
const defaultSports = [
  {
    name: 'Soccer',
    code: 'SOCCER',
    template: 'soccer',
    description: 'Football/Soccer sport',
    is_active: true,
    is_default: true
  },
  {
    name: 'Baseball',
    code: 'BASEBALL',
    template: 'baseball',
    description: 'Baseball sport',
    is_active: true,
    is_default: true
  },
  {
    name: 'Volleyball',
    code: 'VOLLEYBALL',
    template: 'volleyball',
    description: 'Volleyball sport',
    is_active: true,
    is_default: true
  }
];
```

### 2단계: 배구 템플릿 생성
#### 2.1 템플릿 파일 생성
- **파일명**: `views/volleyball-template.ejs`
- **기반**: `views/soccer-template.ejs` (5,055줄) 복사 후 수정
- **크기**: 1920x1080 (축구와 동일)

#### 2.2 타이머 관련 코드 제거 (필수)
**제거할 CSS 클래스:**
- `.match-timer-section`
- `.match-time`
- 타이머 관련 스타일

**제거할 HTML 요소:**
```html
<!-- 제거할 부분 -->
<div class="match-timer-section">
    <div class="match-time">
        <%= (match.match_data?.minute || 0).toString().padStart(2, '0') %>:<%= (match.match_data?.second || 0).toString().padStart(2, '0') %>
    </div>
</div>
```

**제거할 JavaScript:**
- `hybrid-timer-system.js` 스크립트 로드
- `timerState` 객체
- `handleTimerUpdate()` 함수
- `handleTimerReset()` 함수
- 타이머 관련 소켓 이벤트
- `HybridTimerSystem` 초기화 코드

#### 2.3 배구 전용 요소 추가
**배구 특화 정보:**
- **세트 스코어 표시**: 각 세트별 점수 (25-23, 25-21, 25-19 등)
- **세트 수 표시**: 현재 세트 (1세트, 2세트, 3세트, 4세트, 5세트)
- **세트 승리 횟수**: 각 팀이 획득한 세트 수 (2-1, 3-0 등)
- **서브 권한 표시**: 현재 서브를 진행하는 팀 표시
- **세트 포인트 표시**: 24-24 상황에서의 세트 포인트 표시
- **경기 상태 표시**: 세트 진행 상황, 경기 종료 상태 등
- **배구 포지션별 라인업**: 리베로, 세터, 윙 스파이커, 미들 블로커 등

### 3단계: 컨트롤 페이지 생성
#### 3.1 컨트롤 페이지 생성
- **파일명**: `views/volleyball-control.ejs`
- **기반**: `views/soccer-control.ejs` (4,404줄) 복사 후 수정
- **타이머 컨트롤 제거**: 시작/정지/리셋 버튼 제거

**제거할 요소:**
- `.timer-section` CSS 클래스
- `.timer-display` CSS 클래스  
- `.timer-controls` CSS 클래스
- 타이머 HTML 섹션 전체
- `startTimer()`, `stopTimer()`, `resetTimer()` 함수

#### 3.2 모바일 컨트롤 페이지 생성
- **파일명**: `views/volleyball-control-mobile.ejs`
- **기반**: `views/soccer-control-mobile.ejs` (1,388줄) 복사 후 수정
- **타이머 컨트롤 제거**: 모바일 타이머 컨트롤 제거

**제거할 요소:**
- `.timer-section` CSS 클래스
- `#timer-display` CSS 클래스
- `.timer-controls` CSS 클래스
- `.timer-btn` CSS 클래스
- 타이머 HTML 섹션 전체
- 모바일 타이머 관련 JavaScript 함수

### 4단계: 라우팅 및 API 설정
#### 4.1 라우터 수정
- `routes/matches.js`에서 배구 경기 생성 지원
- `routes/sports.js`에서 배구 종목 관리 지원

#### 4.2 API 엔드포인트 확인
- `/api/sport` - 종목 목록 (배구 포함)
- `/api/matches` - 경기 관리 (배구 경기 지원)
- `/api/templates` - 템플릿 관리 (배구 템플릿 지원)

### 5단계: 오버레이 이미지 폴더 생성
#### 5.1 폴더 구조 생성
```
public/overlay-images/
├── SOCCER/
├── BASEBALL/
└── VOLLEYBALL/  # 새로 생성
```

#### 5.2 기본 오버레이 이미지 추가
- 배구 관련 기본 오버레이 이미지들
- 로고, 배경, 효과 이미지 등

### 6단계: 팀 로고 시스템 연동
#### 6.1 팀 로고 폴더 생성
```
public/TEAMLOGO/
├── SOCCER/
├── BASEBALL/
└── VOLLEYBALL/  # 새로 생성
```

#### 6.2 배구 팀 로고 관리
- `routes/team-logos.js`에서 배구 팀 로고 지원
- 배구 팀 로고 업로드/관리 기능

## 🔧 배구 스코어보드 구조

### 스코어보드 HTML 구조
```html
<div class="scoreboard">
    <div class="team-section home">
        <div class="team-content">
            <div class="team-name"><%= match.home_team || 'HOME' %></div>
            <!-- 세트 승리 횟수 표시 -->
            <div class="set-wins"><%= match.match_data?.home_set_wins || 0 %></div>
        </div>
    </div>
    <div class="score-section">
        <!-- 현재 세트 스코어 -->
        <div class="current-set-score">
            <span class="home-score"><%= match.home_score || 0 %></span>
            <span class="score-divider">-</span>
            <span class="away-score"><%= match.away_score || 0 %></span>
        </div>
        <!-- 현재 세트 정보 -->
        <div class="set-info">
            <span class="current-set"><%= match.match_data?.current_set || 1 %>세트</span>
            <span class="serve-indicator" id="serveIndicator">서브: HOME</span>
        </div>
        <!-- 세트별 스코어 히스토리 -->
        <div class="set-scores-history">
            <div class="set-score-item">1세트: 25-23</div>
            <div class="set-score-item">2세트: 25-21</div>
            <div class="set-score-item">3세트: 25-19</div>
        </div>
    </div>
    <div class="team-section away">
        <div class="team-content">
            <div class="team-name"><%= match.away_team || 'AWAY' %></div>
            <!-- 세트 승리 횟수 표시 -->
            <div class="set-wins"><%= match.match_data?.away_set_wins || 0 %></div>
        </div>
    </div>
    <!-- 타이머 섹션 제거 -->
</div>
```

### 배구 특화 CSS 스타일
```css
/* 세트 정보 영역 */
.set-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    color: #fff;
    margin-top: 5px;
}

/* 서브 표시 */
.serve-indicator {
    background-color: #ff6b6b;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: bold;
}

/* 세트 승리 횟수 */
.set-wins {
    font-size: 18px;
    font-weight: bold;
    color: #4ecdc4;
}

/* 세트별 스코어 히스토리 */
.set-scores-history {
    display: flex;
    gap: 10px;
    margin-top: 5px;
}

.set-score-item {
    font-size: 12px;
    color: #ccc;
}
```

### 배구 특화 JavaScript 기능
```javascript
// 서브 권한 업데이트
function updateServeIndicator(servingTeam) {
    const indicator = document.getElementById('serveIndicator');
    indicator.textContent = `서브: ${servingTeam}`;
}

// 세트 승리 횟수 업데이트
function updateSetWins(homeWins, awayWins) {
    document.querySelector('.home-team .set-wins').textContent = homeWins;
    document.querySelector('.away-team .set-wins').textContent = awayWins;
}

// 세트별 스코어 히스토리 업데이트
function updateSetScoresHistory(setScores) {
    const historyContainer = document.querySelector('.set-scores-history');
    historyContainer.innerHTML = '';
    
    setScores.forEach((score, index) => {
        const item = document.createElement('div');
        item.className = 'set-score-item';
        item.textContent = `${index + 1}세트: ${score.home}-${score.away}`;
        historyContainer.appendChild(item);
    });
}
```

## 📁 파일 구조 변경사항

### 새로 생성할 파일
```
views/
├── volleyball-template.ejs      # 배구 오버레이 템플릿 (기반: soccer-template.ejs, 5,055줄)
├── volleyball-control.ejs       # 배구 컨트롤 페이지 (기반: soccer-control.ejs, 4,404줄)
└── volleyball-control-mobile.ejs # 배구 모바일 컨트롤 (기반: soccer-control-mobile.ejs, 1,388줄)

public/
├── overlay-images/VOLLEYBALL/   # 배구 오버레이 이미지
└── TEAMLOGO/VOLLEYBALL/         # 배구 팀 로고
```

### 참고 파일 정보
- **soccer-template.ejs**: 5,055줄, 축구 오버레이 템플릿
- **soccer-control.ejs**: 4,404줄, 축구 컨트롤 페이지 (타이머 섹션 포함)
- **soccer-control-mobile.ejs**: 1,388줄, 축구 모바일 컨트롤 (타이머 섹션 포함)

### 수정할 파일
```
server.js                        # 기본종목 추가
routes/matches.js                # 배구 경기 지원
routes/sports.js                 # 배구 종목 관리
routes/team-logos.js             # 배구 팀 로고 지원
```

## 🚫 금지사항

### 절대 금지
- **🚨 라우터 우선 확인 무시 금지** - server_refactored_new.js에 직접 API 작성 절대 금지
- **🚨 API 작성 위치 규칙 위반 금지** - 모든 API는 해당 라우터에만 작성
- **🚨 규칙 위반 시 즉시 수정 요구** - 규칙을 무시하고 server.js에 API 작성 시 즉시 수정
- **타이머 관련 코드 남기기 금지** - 배구는 타이머가 필요 없으므로 완전 제거
- **기존 축구/야구 기능 손상 금지** - 기존 종목의 기능에 영향 주지 않도록 주의
- **데이터베이스 스키마 변경 금지** - 기존 테이블 구조 변경 없이 새로운 종목만 추가

### 참고 문서 무시 금지
- **🏐 VOLLEYBALL_SPORT_ADDITION_PLAN.md 무시 금지** - 배구 작업 시 최우선 참고
- **🚨 라우터 우선 확인 무시 금지** - 새롭게 추가되거나 수정해야 하는 부분은 항상 해당 라우터를 먼저 확인
- **JAVASCRIPT_FILES_REFERENCE.md 무시한 파일 수정 금지**
- **API_REFERENCE.md 무시한 API 수정 금지**
- **PROJECT_STRUCTURE.md 무시한 구조 변경 금지**

## 📚 문서 참고 우선순위
1. **🚨 라우터 우선 확인 (최우선)** - 새롭게 추가되거나 수정해야 하는 부분은 항상 해당 라우터를 먼저 확인
2. **🏐 VOLLEYBALL_SPORT_ADDITION_PLAN.md** - 배구 기본종목 추가 작업 시 최우선
3. **JAVASCRIPT_FILES_REFERENCE.md** - 파일 작업 시 최우선
4. **API_REFERENCE.md** - API 관련 작업 시 최우선
5. **PROJECT_STRUCTURE.md** - 구조 변경 시 최우선
6. **README.md** - 프로젝트 이해 시 참고

## 🧪 테스트 계획

### 1단계: 기본 기능 테스트
- [ ] 배구 종목이 기본종목으로 등록되는지 확인
- [ ] 배구 템플릿이 정상적으로 로드되는지 확인
- [ ] 타이머 관련 요소가 제거되었는지 확인

### 2단계: 경기 생성 테스트
- [ ] 배구 경기 생성 기능 테스트
- [ ] 배구 경기 데이터 저장 테스트
- [ ] 배구 경기 오버레이 표시 테스트

### 3단계: 컨트롤 기능 테스트
- [ ] 배구 컨트롤 페이지 테스트
- [ ] 스코어 업데이트 기능 테스트
- [ ] 라인업 관리 기능 테스트

### 4단계: 통합 테스트
- [ ] 기존 축구/야구 기능에 영향 없는지 확인
- [ ] 배구 전용 기능 정상 작동 확인
- [ ] 모바일 컨트롤 기능 테스트

## 📋 구현 체크리스트

### Phase 1: 기본 설정
- [ ] server.js에 배구 기본종목 추가
- [ ] 데이터베이스에 배구 종목 생성 확인
- [ ] 기본 폴더 구조 생성

### Phase 2: 템플릿 생성
- [ ] volleyball-template.ejs 생성 (기반: soccer-template.ejs, 5,055줄)
- [ ] 타이머 관련 코드 제거 (hybrid-timer-system.js, timerState, 타이머 함수들)
- [ ] 배구 특화 요소 추가 (세트 스코어, 세트 수, 서브 권한)
- [ ] CSS 스타일 조정 (타이머 섹션 제거, 레이아웃 조정)

### Phase 3: 컨트롤 페이지
- [ ] volleyball-control.ejs 생성 (기반: soccer-control.ejs, 4,404줄)
- [ ] volleyball-control-mobile.ejs 생성 (기반: soccer-control-mobile.ejs, 1,388줄)
- [ ] 타이머 컨트롤 제거 (.timer-section, .timer-display, .timer-controls)
- [ ] 배구 특화 컨트롤 추가 (세트 스코어 관리, 세트 수 관리)

### Phase 4: 라우팅 및 API
- [ ] 라우터에서 배구 지원 확인
- [ ] API 엔드포인트 테스트
- [ ] 오버레이 이미지 폴더 생성
- [ ] 팀 로고 시스템 연동

### Phase 5: 테스트 및 검증
- [ ] 전체 기능 테스트
- [ ] 기존 시스템 호환성 확인
- [ ] 성능 테스트
- [ ] 사용자 경험 테스트

## 🎯 성공 기준

### 기능적 요구사항
- [ ] 배구가 기본종목으로 정상 등록됨
- [ ] 배구 템플릿이 타이머 없이 정상 작동함
- [ ] 배구 경기 생성 및 관리가 가능함
- [ ] 배구 컨트롤 페이지가 정상 작동함

### 기술적 요구사항
- [ ] 기존 축구/야구 기능에 영향 없음
- [ ] 타이머 관련 코드가 완전히 제거됨
- [ ] 배구 특화 기능이 정상 작동함
- [ ] 모바일 지원이 정상 작동함

### 사용자 경험 요구사항
- [ ] 배구 경기 관리가 직관적임
- [ ] 오버레이 표시가 깔끔함
- [ ] 컨트롤 인터페이스가 사용하기 쉬움
- [ ] 모바일에서도 정상 작동함

---

## 📞 문의사항
이 룰에 대한 문의사항이나 수정사항이 있으시면 언제든지 말씀해 주세요.

**작성일**: 2024년 12월 19일  
**작성자**: SportsCoder 개발팀  
**버전**: 1.0
