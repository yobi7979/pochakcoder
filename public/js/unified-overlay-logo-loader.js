// SportsCoder 통합 오버레이 로고 로더
// 모든 종목과 템플릿에서 사용할 수 있는 통합 팀로고 로딩 시스템

class UnifiedOverlayLogoLoader {
    constructor(sportType, matchId) {
        this.sportType = sportType;
        this.matchId = matchId;
        this.logoState = { home: null, away: null };
        this.isInitialized = false;
    }
    
    // 초기 로고 로딩
    async loadTeamLogos() {
        try {
            console.log(`🔧 통합 팀로고 로딩 시작: ${this.sportType} - ${this.matchId}`);
            
            const response = await fetch(`/api/matches/${this.matchId}/team-logos`);
            const result = await response.json();
            
            if (result.success && result.teamLogos) {
                console.log(`✅ 경기별 팀로고 정보 로드 성공: ${result.teamLogos.length}개`);
                
                // 홈팀 로고 설정
                const homeTeamInfo = result.teamLogos.find(team => team.team_type === 'home');
                if (homeTeamInfo) {
                    this.logoState.home = {
                        path: homeTeamInfo.logo_path,
                        bgColor: homeTeamInfo.logo_bg_color || '#ffffff',
                        teamName: homeTeamInfo.team_name
                    };
                    this.updateTeamLogoDisplay('home', this.logoState.home);
                    console.log(`✅ 홈팀 로고 설정 완료: ${homeTeamInfo.team_name}`);
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
                    console.log(`✅ 어웨이팀 로고 설정 완료: ${awayTeamInfo.team_name}`);
                }
                
                this.isInitialized = true;
            } else {
                console.log('⚠️ 경기별 팀로고 정보 없음, 기본 설정 사용');
                this.isInitialized = true;
            }
        } catch (error) {
            console.error('❌ 팀로고 로딩 실패:', error);
            this.isInitialized = true;
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
                    console.log(`✅ ${teamType}팀 로고 표시: ${logoInfo.teamName}`);
                } else {
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                    container.style.backgroundColor = '#ffffff';
                    console.log(`⚠️ ${teamType}팀 로고 없음, 플레이스홀더 표시`);
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
                console.log(`⚠️ 알 수 없는 템플릿: ${templateName}`);
                return [];
        }
    }
    
    // 현재 템플릿 이름 감지
    getTemplateName() {
        const body = document.body;
        const title = document.title;
        
        if (body.classList.contains('soccer-template') || title.includes('Soccer')) {
            return 'soccer-template';
        }
        if (body.classList.contains('baseball-template') || title.includes('Baseball')) {
            return 'baseball-template';
        }
        
        // URL 기반 감지
        const pathname = window.location.pathname;
        if (pathname.includes('soccer')) return 'soccer-template';
        if (pathname.includes('baseball')) return 'baseball-template';
        
        return 'unknown';
    }
    
    // 로고 상태 업데이트 (WebSocket 이벤트용)
    updateLogoState(teamType, logoInfo) {
        this.logoState[teamType] = logoInfo;
        this.updateTeamLogoDisplay(teamType, logoInfo);
    }
    
    // 로고 상태 가져오기
    getLogoState() {
        return this.logoState;
    }
    
    // 초기화 상태 확인
    isReady() {
        return this.isInitialized;
    }
}

// 전역 인스턴스
let overlayLogoLoader = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔧 통합 오버레이 로고 로더 초기화 시작');
    
    // 경기 ID와 종목 타입 감지
    const matchId = window.matchId || getMatchIdFromUrl();
    const sportType = window.sportType || getSportTypeFromUrl() || 'SOCCER';
    
    if (matchId) {
        console.log(`🔧 로고 로더 초기화: ${sportType} - ${matchId}`);
        overlayLogoLoader = new UnifiedOverlayLogoLoader(sportType, matchId);
        await overlayLogoLoader.loadTeamLogos();
        console.log('✅ 통합 오버레이 로고 로더 초기화 완료');
    } else {
        console.log('⚠️ 경기 ID를 찾을 수 없음, 로고 로더 초기화 건너뜀');
    }
});

// URL에서 경기 ID 추출
function getMatchIdFromUrl() {
    const pathname = window.location.pathname;
    const match = pathname.match(/\/match\/([^\/]+)/);
    return match ? match[1] : null;
}

// URL에서 종목 타입 추출
function getSportTypeFromUrl() {
    const pathname = window.location.pathname;
    if (pathname.includes('soccer')) return 'SOCCER';
    if (pathname.includes('baseball')) return 'BASEBALL';
    return null;
}

// WebSocket 이벤트 처리
if (typeof socket !== 'undefined') {
    // 통합 팀로고 업데이트 이벤트 처리
    socket.on('teamLogoUpdated', function(data) {
        console.log('🔔 통합 팀로고 업데이트 이벤트 수신:', data);
        
        if (data.matchId === window.matchId && overlayLogoLoader) {
            overlayLogoLoader.updateLogoState(data.teamType, {
                path: data.logoPath,
                bgColor: data.logoBgColor,
                teamName: data.teamName
            });
        }
    });
    
    // 팀로고 배경색 업데이트 이벤트 처리
    socket.on('teamLogoBgUpdated', function(data) {
        console.log('🔔 팀로고 배경색 업데이트 이벤트 수신:', data);
        
        if (data.matchId === window.matchId && overlayLogoLoader) {
            const logoState = overlayLogoLoader.getLogoState();
            if (logoState[data.teamType]) {
                logoState[data.teamType].bgColor = data.logoBgColor;
                overlayLogoLoader.updateTeamLogoDisplay(data.teamType, logoState[data.teamType]);
            }
        }
    });
}

// 전역 함수로 노출
window.UnifiedOverlayLogoLoader = UnifiedOverlayLogoLoader;
window.overlayLogoLoader = overlayLogoLoader;
