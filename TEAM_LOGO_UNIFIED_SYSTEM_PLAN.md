# 🏆 SportsCoder 통합 팀로고 시스템 구현 계획서

## 📋 **프로젝트 개요**

### **목표**
축구와 야구의 팀로고 시스템을 통합하여 새로운 종목과 템플릿 추가 시에도 문제없이 확장 가능한 통합 시스템 구축

### **현재 상황 분석**
- **축구**: TeamInfo 테이블 기반, 경기별 팀로고 관리
- **야구**: Match.match_data JSON 필드 기반, 경기별 팀로고 관리
- **오버레이**: 각각 다른 API 엔드포인트와 로딩 방식 사용

---

## 🎯 **Phase 1: 데이터베이스 구조 통일**

### **1.1 새로운 테이블 설계**

#### **TeamLogo 테이블 (마스터 테이블)**
```sql
CREATE TABLE TeamLogo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sport_type VARCHAR(50) NOT NULL,           -- 'SOCCER', 'BASEBALL', 'BASKETBALL' 등
    team_name VARCHAR(100) NOT NULL,            -- 팀명
    logo_path VARCHAR(500) NOT NULL,           -- 로고 파일 경로
    logo_bg_color VARCHAR(7) DEFAULT '#ffffff', -- 로고 배경색
    is_active BOOLEAN DEFAULT true,             -- 활성화 상태
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_type, team_name)               -- 종목별 팀명 중복 방지
);
```

#### **MatchTeamLogo 테이블 (경기별 연결)**
```sql
CREATE TABLE MatchTeamLogo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id VARCHAR(50) NOT NULL,              -- 경기 ID
    team_type VARCHAR(10) NOT NULL,             -- 'home' 또는 'away'
    team_logo_id INTEGER NOT NULL,              -- TeamLogo 테이블 참조
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES Match(id) ON DELETE CASCADE,
    FOREIGN KEY (team_logo_id) REFERENCES TeamLogo(id) ON DELETE CASCADE,
    UNIQUE(match_id, team_type)                 -- 경기당 팀 타입별 하나만
);
```

#### **SportTeamLogoConfig 테이블 (종목별 설정)**
```sql
CREATE TABLE SportTeamLogoConfig (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sport_type VARCHAR(50) NOT NULL UNIQUE,    -- 종목 타입
    default_logo_size VARCHAR(20) DEFAULT '40px', -- 기본 로고 크기
    default_bg_color VARCHAR(7) DEFAULT '#ffffff', -- 기본 배경색
    logo_upload_path VARCHAR(200) DEFAULT '/TEAMLOGO', -- 업로드 경로
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **1.2 기존 데이터 마이그레이션**

#### **축구 데이터 마이그레이션**
```javascript
// TeamInfo → TeamLogo + MatchTeamLogo
async function migrateSoccerData() {
    const teamInfos = await TeamInfo.findAll();
    
    for (const teamInfo of teamInfos) {
        if (teamInfo.logo_path) {
            // TeamLogo 생성
            const teamLogo = await TeamLogo.create({
                sport_type: 'SOCCER',
                team_name: teamInfo.team_name,
                logo_path: teamInfo.logo_path,
                logo_bg_color: teamInfo.logo_bg_color || '#ffffff'
            });
            
            // MatchTeamLogo 연결
            await MatchTeamLogo.create({
                match_id: teamInfo.match_id,
                team_type: teamInfo.team_type,
                team_logo_id: teamLogo.id
            });
        }
    }
}
```

#### **야구 데이터 마이그레이션**
```javascript
// Match.match_data → TeamLogo + MatchTeamLogo
async function migrateBaseballData() {
    const matches = await Match.findAll({
        where: {
            sport_type: 'BASEBALL',
            match_data: { [Op.ne]: null }
        }
    });
    
    for (const match of matches) {
        const matchData = match.match_data;
        
        // 홈팀 로고 처리
        if (matchData.home_team_logo) {
            const homeTeamLogo = await TeamLogo.create({
                sport_type: 'BASEBALL',
                team_name: match.home_team,
                logo_path: matchData.home_team_logo,
                logo_bg_color: matchData.home_team_colorbg || '#ffffff'
            });
            
            await MatchTeamLogo.create({
                match_id: match.id,
                team_type: 'home',
                team_logo_id: homeTeamLogo.id
            });
        }
        
        // 어웨이팀 로고 처리
        if (matchData.away_team_logo) {
            const awayTeamLogo = await TeamLogo.create({
                sport_type: 'BASEBALL',
                team_name: match.away_team,
                logo_path: matchData.away_team_logo,
                logo_bg_color: matchData.away_team_colorbg || '#ffffff'
            });
            
            await MatchTeamLogo.create({
                match_id: match.id,
                team_type: 'away',
                team_logo_id: awayTeamLogo.id
            });
        }
    }
}
```

---

## 🚀 **Phase 2: 통합 API 엔드포인트 구현**

### **2.1 새로운 라우터 생성**
```javascript
// routes/team-logos.js
const express = require('express');
const router = express.Router();
const { TeamLogo, MatchTeamLogo, Match, SportTeamLogoConfig } = require('../models');

// GET /api/team-logos/:sportType - 종목별 팀로고 목록
router.get('/:sportType', async (req, res) => {
    const { sportType } = req.params;
    const teamLogos = await TeamLogo.findAll({
        where: { 
            sport_type: sportType.toUpperCase(),
            is_active: true 
        },
        order: [['team_name', 'ASC']]
    });
    res.json({ success: true, teamLogos });
});

// GET /api/matches/:matchId/team-logos - 경기별 팀로고 정보
router.get('/:matchId/team-logos', async (req, res) => {
    const { matchId } = req.params;
    const matchTeamLogos = await MatchTeamLogo.findAll({
        where: { match_id: matchId },
        include: [{
            model: TeamLogo,
            as: 'teamLogo'
        }]
    });
    
    const teamLogos = matchTeamLogos.map(mtl => ({
        team_type: mtl.team_type,
        logo_path: mtl.teamLogo.logo_path,
        logo_bg_color: mtl.teamLogo.logo_bg_color,
        team_name: mtl.teamLogo.team_name
    }));
    
    res.json({ success: true, teamLogos });
});

// POST /api/team-logos - 새 팀로고 생성
router.post('/', async (req, res) => {
    const { sport_type, team_name, logo_path, logo_bg_color } = req.body;
    
    const teamLogo = await TeamLogo.create({
        sport_type: sport_type.toUpperCase(),
        team_name,
        logo_path,
        logo_bg_color: logo_bg_color || '#ffffff'
    });
    
    res.json({ success: true, teamLogo });
});

// PUT /api/matches/:matchId/team-logos - 경기 팀로고 설정
router.put('/:matchId/team-logos', async (req, res) => {
    const { matchId } = req.params;
    const { home_team_logo_id, away_team_logo_id } = req.body;
    
    // 기존 연결 삭제
    await MatchTeamLogo.destroy({ where: { match_id: matchId } });
    
    // 새 연결 생성
    if (home_team_logo_id) {
        await MatchTeamLogo.create({
            match_id,
            team_type: 'home',
            team_logo_id: home_team_logo_id
        });
    }
    
    if (away_team_logo_id) {
        await MatchTeamLogo.create({
            match_id,
            team_type: 'away',
            team_logo_id: away_team_logo_id
        });
    }
    
    res.json({ success: true });
});
```

### **2.2 기존 API 호환성 유지**
```javascript
// 기존 /api/overlay-images/TEAMLOGO/:sportType API 유지
router.get('/TEAMLOGO/:sportType', async (req, res) => {
    const { sportType } = req.params;
    
    // 새로운 통합 API로 리다이렉트
    const response = await fetch(`/api/team-logos/${sportType}`);
    const data = await response.json();
    
    // 기존 형식으로 변환
    const teamLogoMap = {};
    data.teamLogos.forEach(logo => {
        teamLogoMap[logo.team_name] = {
            path: logo.logo_path,
            bgColor: logo.logo_bg_color
        };
    });
    
    res.json({ teamLogoMap });
});
```

---

## 🎨 **Phase 3: 통합 오버레이 로고 로딩 시스템**

### **3.1 통합 로고 로더 클래스**
```javascript
// public/js/unified-overlay-logo-loader.js
class UnifiedOverlayLogoLoader {
    constructor(sportType, matchId) {
        this.sportType = sportType;
        this.matchId = matchId;
        this.logoState = { home: null, away: null };
    }
    
    // 초기 로고 로딩
    async loadTeamLogos() {
        try {
            const response = await fetch(`/api/matches/${this.matchId}/team-logos`);
            const result = await response.json();
            
            if (result.success && result.teamLogos) {
                // 홈팀 로고 설정
                const homeTeamInfo = result.teamLogos.find(team => team.team_type === 'home');
                if (homeTeamInfo) {
                    this.logoState.home = {
                        path: homeTeamInfo.logo_path,
                        bgColor: homeTeamInfo.logo_bg_color || '#ffffff',
                        teamName: homeTeamInfo.team_name
                    };
                    this.updateTeamLogoDisplay('home', this.logoState.home);
                }
                
                // 어웨이팀 로고 설정
                const awayTeamInfo = result.teamLogos.find(team => team.team_type === 'away');
                if (awayTeamInfo) {
                    this.logoState.away = {
                        path: awayTeamInfo.logo_path,
                        bgColor: awayTeamInfo.logo_bg_color || '#ffffff',
                        teamName: awayTeamInfo.team_name
                    };
                    this.updateTeamLogoDisplay('away', this.logoState.away);
                }
            }
        } catch (error) {
            console.error('팀로고 로딩 실패:', error);
        }
    }
    
    // 템플릿별 맞춤 표시 업데이트
    updateTeamLogoDisplay(teamType, logoInfo) {
        const selectors = this.getTemplateSelectors(teamType);
        
        selectors.forEach(selector => {
            const container = document.querySelector(selector.container);
            const img = document.querySelector(selector.img);
            const placeholder = document.querySelector(selector.placeholder);
            
            if (container && img && placeholder) {
                if (logoInfo && logoInfo.path) {
                    img.src = logoInfo.path;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                    container.style.backgroundColor = logoInfo.bgColor;
                } else {
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                    container.style.backgroundColor = '#ffffff';
                }
            }
        });
    }
    
    // 템플릿별 셀렉터 설정
    getTemplateSelectors(teamType) {
        const templateName = this.getTemplateName();
        
        switch (templateName) {
            case 'soccer-template':
                return [{
                    container: `.team-section.${teamType} .team-logo`,
                    img: `#${teamType}-logo`,
                    placeholder: `#${teamType}-placeholder`
                }, {
                    container: `.vs-team-section.${teamType} .vs-team-logo`,
                    img: `#vs-${teamType}-logo`,
                    placeholder: `#vs-${teamType}-placeholder`
                }];
                
            case 'baseball-template':
                return [{
                    container: `.team-info.${teamType}-team .team-logo-container`,
                    img: `.team-info.${teamType}-team .team-logo img`,
                    placeholder: `.team-info.${teamType}-team .team-logo-placeholder`
                }];
                
            default:
                return [];
        }
    }
    
    getTemplateName() {
        const body = document.body;
        if (body.classList.contains('soccer-template')) return 'soccer-template';
        if (body.classList.contains('baseball-template')) return 'baseball-template';
        return 'unknown';
    }
}

// 전역 인스턴스 생성
let overlayLogoLoader;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    const sportType = window.sportType || 'SOCCER';
    const matchId = window.matchId;
    
    if (matchId) {
        overlayLogoLoader = new UnifiedOverlayLogoLoader(sportType, matchId);
        await overlayLogoLoader.loadTeamLogos();
    }
});
```

### **3.2 WebSocket 이벤트 통일**
```javascript
// 통합 팀로고 업데이트 이벤트 처리
socket.on('teamLogoUpdated', function(data) {
    if (data.matchId === matchId) {
        if (overlayLogoLoader) {
            overlayLogoLoader.logoState[data.teamType] = {
                path: data.logoPath,
                bgColor: data.logoBgColor,
                teamName: data.teamName
            };
            
            overlayLogoLoader.updateTeamLogoDisplay(data.teamType, overlayLogoLoader.logoState[data.teamType]);
        }
    }
});
```

---

## 🔧 **Phase 4: 프론트엔드 UI 통합**

### **4.1 통합 팀로고 선택 모달**
```javascript
// public/js/unified-team-logo-modal.js
class UnifiedTeamLogoModal {
    constructor(sportType, matchId, teamType) {
        this.sportType = sportType;
        this.matchId = matchId;
        this.teamType = teamType;
        this.availableLogos = [];
    }
    
    async open() {
        // 종목별 팀로고 목록 로드
        await this.loadAvailableLogos();
        
        // 모달 표시
        this.showModal();
    }
    
    async loadAvailableLogos() {
        try {
            const response = await fetch(`/api/team-logos/${this.sportType}`);
            const result = await response.json();
            
            if (result.success) {
                this.availableLogos = result.teamLogos;
            }
        } catch (error) {
            console.error('팀로고 목록 로드 실패:', error);
        }
    }
    
    showModal() {
        const modal = document.createElement('div');
        modal.className = 'unified-team-logo-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.sportType} 팀로고 선택</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="logo-grid">
                        ${this.availableLogos.map(logo => `
                            <div class="logo-item" data-logo-id="${logo.id}">
                                <img src="${logo.logo_path}" alt="${logo.team_name}">
                                <span>${logo.team_name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">취소</button>
                    <button class="btn-confirm">확인</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.setupEventListeners(modal);
    }
    
    setupEventListeners(modal) {
        // 로고 선택 이벤트
        modal.querySelectorAll('.logo-item').forEach(item => {
            item.addEventListener('click', () => {
                modal.querySelectorAll('.logo-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
        
        // 확인 버튼
        modal.querySelector('.btn-confirm').addEventListener('click', () => {
            const selected = modal.querySelector('.logo-item.selected');
            if (selected) {
                const logoId = selected.dataset.logoId;
                this.selectLogo(logoId);
            }
            modal.remove();
        });
        
        // 취소 버튼
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        // 닫기 버튼
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });
    }
    
    async selectLogo(logoId) {
        try {
            const response = await fetch(`/api/matches/${this.matchId}/team-logos`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    [`${this.teamType}_team_logo_id`]: logoId
                })
            });
            
            if (response.ok) {
                // WebSocket으로 다른 클라이언트에게 알림
                socket.emit('teamLogoUpdated', {
                    matchId: this.matchId,
                    teamType: this.teamType,
                    logoId: logoId
                });
            }
        } catch (error) {
            console.error('팀로고 선택 실패:', error);
        }
    }
}
```

### **4.2 컨트롤 페이지 통합**
```javascript
// 기존 팀로고 프리뷰 클릭 시 통합 모달 열기
function openUnifiedLogoModal(teamType) {
    const sportType = window.sportType || 'SOCCER';
    const matchId = window.matchId;
    
    const modal = new UnifiedTeamLogoModal(sportType, matchId, teamType);
    modal.open();
}

// 기존 코드 수정
document.querySelectorAll('.team-logo-preview').forEach(preview => {
    preview.addEventListener('click', (e) => {
        const teamType = e.currentTarget.id.includes('home') ? 'home' : 'away';
        openUnifiedLogoModal(teamType);
    });
});
```

---

## 📊 **Phase 5: 테스트 및 검증**

### **5.1 기능 테스트**
- [ ] 축구 경기 팀로고 설정/변경
- [ ] 야구 경기 팀로고 설정/변경
- [ ] 오버레이 페이지 실시간 업데이트
- [ ] 새로고침 시 로고 유지
- [ ] WebSocket 통신 정상 작동

### **5.2 성능 테스트**
- [ ] 대용량 팀로고 목록 로딩 속도
- [ ] 동시 접속자 처리
- [ ] 메모리 사용량 최적화

### **5.3 호환성 테스트**
- [ ] 기존 축구 경기 데이터 유지
- [ ] 기존 야구 경기 데이터 유지
- [ ] 기존 API 엔드포인트 호환성

---

## 🚀 **Phase 6: 배포 및 마이그레이션**

### **6.1 단계별 배포**
1. **데이터베이스 마이그레이션 스크립트 실행**
2. **새로운 API 엔드포인트 배포**
3. **프론트엔드 통합 코드 배포**
4. **기존 데이터 마이그레이션 실행**

### **6.2 롤백 계획**
- 기존 API 엔드포인트 유지
- 기존 데이터 백업
- 단계별 롤백 가능

---

## 📋 **구현 체크리스트**

### **데이터베이스**
- [ ] TeamLogo 테이블 생성
- [ ] MatchTeamLogo 테이블 생성
- [ ] SportTeamLogoConfig 테이블 생성
- [ ] 기존 데이터 마이그레이션 스크립트 작성

### **API 엔드포인트**
- [ ] /api/team-logos/:sportType 구현
- [ ] /api/matches/:matchId/team-logos 구현
- [ ] 기존 API 호환성 유지
- [ ] WebSocket 이벤트 통일

### **프론트엔드**
- [ ] 통합 오버레이 로고 로더 구현
- [ ] 통합 팀로고 선택 모달 구현
- [ ] 컨트롤 페이지 통합
- [ ] 오버레이 페이지 통합

### **테스트**
- [ ] 기능 테스트 완료
- [ ] 성능 테스트 완료
- [ ] 호환성 테스트 완료

---

## 🎯 **예상 효과**

### **개발자 경험**
- 일관된 API 구조로 개발 효율성 향상
- 새로운 종목 추가 시 자동 설정
- 코드 재사용성 극대화

### **사용자 경험**
- 모든 종목에서 동일한 UI/UX
- 실시간 팀로고 업데이트
- 직관적인 팀로고 선택

### **시스템 안정성**
- 중복 데이터 제거
- 관계형 데이터베이스 활용
- 확장 가능한 아키텍처

---

## 📝 **주의사항**

### **데이터 마이그레이션**
- 기존 데이터 백업 필수
- 단계별 마이그레이션 실행
- 롤백 계획 준비

### **API 호환성**
- 기존 API 엔드포인트 유지
- 점진적 마이그레이션
- 사용자 영향 최소화

### **성능 최적화**
- 대용량 데이터 처리 고려
- 인덱스 최적화
- 캐싱 전략 수립

---

**작성일**: 2025-01-14  
**작성자**: SportsCoder AI Assistant  
**버전**: 1.0  
**상태**: 계획 수립 완료

---

## 🧪 **작업 완료 후 테스트 룰**

### **테스트 진행 규칙**
1. **각 Phase 완료 시 즉시 테스트 진행**
2. **기능 테스트**: 해당 Phase의 모든 기능이 정상 작동하는지 확인
3. **통합 테스트**: 기존 시스템과의 호환성 확인
4. **성능 테스트**: 메모리 사용량, 응답 속도 확인
5. **오류 처리**: 예외 상황에서의 안정성 확인

### **테스트 체크리스트**
- [ ] 데이터베이스 연결 및 쿼리 정상 작동
- [ ] API 엔드포인트 응답 정상
- [ ] WebSocket 통신 정상
- [ ] 프론트엔드 UI 정상 표시
- [ ] 기존 기능 영향 없음
- [ ] 오류 로그 없음

### **테스트 실패 시 대응**
1. **즉시 롤백**: 문제 발생 시 이전 상태로 복구
2. **오류 분석**: 로그 및 콘솔 메시지 분석
3. **수정 후 재테스트**: 문제 해결 후 다시 테스트
4. **문서 업데이트**: 발견된 문제점과 해결책 기록
