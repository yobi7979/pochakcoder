/**
 * 축구 경기 애니메이션 컨트롤 패널
 * 컨트롤 패널에서 애니메이션을 제어하는 기능을 제공합니다.
 */

// 애니메이션 컨트롤 패널 객체
const SoccerAnimationControls = {
    // 초기화 함수
    init: function() {
        // 애니메이션 버튼 생성
        this.createAnimationButtons();
        
        // 소켓 이벤트 리스너 등록
        this.setupSocketListeners();
        
        console.log('애니메이션 컨트롤 패널 초기화 완료');
    },
    
    // 애니메이션 버튼 생성
    createAnimationButtons: function() {
        // 애니메이션 컨트롤 섹션 생성
        const animationSection = document.createElement('div');
        animationSection.className = 'animation-section mt-4';
        animationSection.innerHTML = `
            <div class="team-section">
                <h4>애니메이션 컨트롤</h4>
                <div class="row mt-3">
                    <div class="col-12 mb-3">
                        <button id="animate-scoreboard" class="btn btn-primary me-2">스코어보드 애니메이션</button>
                        <button id="animate-home-team" class="btn btn-primary me-2">홈팀 애니메이션</button>
                        <button id="animate-away-team" class="btn btn-primary me-2">원정팀 애니메이션</button>
                        <button id="animate-match-time" class="btn btn-primary me-2">경기시간 애니메이션</button>
                        <button id="animate-stats" class="btn btn-primary me-2">통계 애니메이션</button>
                        <button id="animate-all" class="btn btn-success">모든 애니메이션</button>
                    </div>
                    <div class="col-12 mb-3">
                        <button id="animate-goal" class="btn btn-warning me-2">골 애니메이션</button>
                        <button id="animate-warning" class="btn btn-warning me-2">경고 애니메이션</button>
                        <button id="animate-red-card" class="btn btn-danger me-2">퇴장 애니메이션</button>
                        <button id="animate-substitution" class="btn btn-info me-2">교체 애니메이션</button>
                        <button id="animate-corner-kick" class="btn btn-secondary me-2">코너킥 애니메이션</button>
                        <button id="animate-foul" class="btn btn-secondary me-2">파울 애니메이션</button>
                    </div>
                </div>
            </div>
        `;
        
        // 컨트롤 패널에 애니메이션 섹션 추가
        const controlPanel = document.querySelector('.control-panel');
        if (controlPanel) {
            // 경기 목록으로 버튼 앞에 삽입
            const backButton = controlPanel.querySelector('.mt-4');
            if (backButton) {
                controlPanel.insertBefore(animationSection, backButton);
            } else {
                controlPanel.appendChild(animationSection);
            }
            
            // 버튼 이벤트 리스너 등록
            this.setupButtonListeners();
        } else {
            console.error('컨트롤 패널을 찾을 수 없습니다.');
        }
    },
    
    // 버튼 이벤트 리스너 설정
    setupButtonListeners: function() {
        // 섹션별 애니메이션 버튼
        document.getElementById('animate-scoreboard').addEventListener('click', () => {
            this.sendAnimationEvent('scoreboard');
        });

        document.getElementById('animate-scoreboard').addEventListener('click', () => {
            this.sendAnimationEvent('scoreboard2');
        });
        
        document.getElementById('animate-home-team').addEventListener('click', () => {
            this.sendAnimationEvent('homeTeam');
        });
        
        document.getElementById('animate-away-team').addEventListener('click', () => {
            this.sendAnimationEvent('awayTeam');
        });
        
        document.getElementById('animate-match-time').addEventListener('click', () => {
            this.sendAnimationEvent('matchTime');
        });
        
        document.getElementById('animate-stats').addEventListener('click', () => {
            this.sendAnimationEvent('stats');
        });
        
        document.getElementById('animate-all').addEventListener('click', () => {
            this.sendAnimationEvent('all');
        });
        
        // 특수 애니메이션 버튼
        document.getElementById('animate-goal').addEventListener('click', () => {
            this.sendSpecialAnimationEvent('goal');
        });
        
        document.getElementById('animate-warning').addEventListener('click', () => {
            this.sendSpecialAnimationEvent('warning');
        });
        
        document.getElementById('animate-red-card').addEventListener('click', () => {
            this.sendSpecialAnimationEvent('redCard');
        });
        
        document.getElementById('animate-substitution').addEventListener('click', () => {
            this.sendSpecialAnimationEvent('substitution');
        });
        
        document.getElementById('animate-corner-kick').addEventListener('click', () => {
            this.sendSpecialAnimationEvent('cornerKick');
        });
        
        document.getElementById('animate-foul').addEventListener('click', () => {
            this.sendSpecialAnimationEvent('foul');
        });
    },
    
    // 소켓 이벤트 리스너 설정
    setupSocketListeners: function() {
        // 소켓이 존재하는지 확인
        if (typeof io !== 'undefined' && typeof socket !== 'undefined') {
            // 애니메이션 이벤트 수신
            socket.on('animation_response', function(data) {
                console.log('애니메이션 응답 수신:', data);
                
                if (data.success) {
                    console.log('애니메이션 실행 성공');
                } else {
                    console.error('애니메이션 실행 실패:', data.error);
                }
            });
        } else {
            console.warn('소켓이 정의되지 않아 애니메이션 이벤트 리스너를 등록할 수 없습니다.');
        }
    },
    
    // 애니메이션 이벤트 전송
    sendAnimationEvent: function(section) {
        // 소켓이 존재하는지 확인
        if (typeof io !== 'undefined' && typeof socket !== 'undefined') {
            // 애니메이션 이벤트 전송
            socket.emit('animation', {
                matchId: matchId,
                section: section,
                all: section === 'all'
            });
            
            console.log(`애니메이션 이벤트 전송: ${section}`);
        } else {
            console.error('소켓이 정의되지 않아 애니메이션 이벤트를 전송할 수 없습니다.');
        }
    },
    
    // 특수 애니메이션 이벤트 전송
    sendSpecialAnimationEvent: function(type) {
        // 소켓이 존재하는지 확인
        if (typeof io !== 'undefined' && typeof socket !== 'undefined') {
            // 특수 애니메이션 이벤트 전송
            socket.emit('special_animation', {
                matchId: matchId,
                type: type
            });
            
            console.log(`특수 애니메이션 이벤트 전송: ${type}`);
        } else {
            console.error('소켓이 정의되지 않아 특수 애니메이션 이벤트를 전송할 수 없습니다.');
        }
    }
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    SoccerAnimationControls.init();
}); 