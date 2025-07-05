/**
 * 축구 경기 오버레이 애니메이션 관리자
 * 각 섹션별 애니메이션을 제어하는 기능을 제공합니다.
 */

// 애니메이션 관리자 객체
const SoccerAnimationManager = {
    // 애니메이션 상태 저장
    animationStates: {
        scoreboard: false,
        homeTeam: false,
        awayTeam: false,
        matchTime: false,
        stats: false
    },
    
    // 애니메이션 클래스 정의
    animationClasses: {
        scoreboard: 'animate-slide',
        scoreboard2: 'animate-slide',
        homeTeam: 'animate-slide',
        awayTeam: 'animate-slide',
        matchTime: 'animate-slide',
        stats: 'animate-slide'
    },
    
    /**
     * 특정 섹션의 애니메이션을 실행합니다.
     * @param {string} section 애니메이션을 적용할 섹션 이름
     * @param {boolean} force 이미 실행 중인 애니메이션을 강제로 다시 실행할지 여부
     * @returns {boolean} 애니메이션 실행 성공 여부
     */
    playAnimation: function(section, force) {
        // 기본값 설정
        force = force || false;
        
        // 섹션이 존재하는지 확인
        if (!this.animationClasses[section]) {
            console.error(`알 수 없는 섹션: ${section}`);
            return false;
        }
        
        // 스코어보드 토글 처리
        if (section === 'scoreboard') {
            const scoreboard = document.querySelector('.scoreboard');
            if (!scoreboard) {
                console.error('스코어보드 요소를 찾을 수 없습니다.');
                return false;
            }

            // 현재 표시 상태 확인
            const isVisible = !scoreboard.classList.contains('animate-slide-up');
            
            if (isVisible) {
                // 위로 사라지는 애니메이션 적용
                scoreboard.classList.remove('animate-slide');
                scoreboard.classList.add('animate-slide-up');
                console.log('스코어보드 숨김');
            } else {
                // 나타나는 애니메이션 적용
                scoreboard.classList.remove('animate-slide-up');
                scoreboard.classList.add('animate-slide');
                console.log('스코어보드 표시');
            }
            
            return true;
        }
        
        // 시간 섹션 토글 처리
        if (section === 'matchTime') {
            const element = document.querySelector('.match-time');
            if (!element) {
                console.error('시간 섹션 요소를 찾을 수 없습니다.');
                return false;
            }

            // 현재 표시 상태 확인
            const isVisible = element.style.display !== 'none';
            
            if (isVisible) {
                // 숨기기
                element.style.display = 'none';
                console.log('시간 섹션 숨김');
            } else {
                // 보이기
                element.style.display = 'block';
                // 애니메이션 클래스 추가
                element.classList.add(this.animationClasses[section]);
                // 애니메이션 종료 후 클래스 제거
                setTimeout(() => {
                    element.classList.remove(this.animationClasses[section]);
                }, 500);
                console.log('시간 섹션 표시');
            }
            
            return true;
        }
        
        // 다른 섹션들의 애니메이션 처리
        let element;
        switch (section) {
            case 'homeTeam':
                element = document.querySelector('.home-team');
                break;
            case 'awayTeam':
                element = document.querySelector('.away-team');
                break;
            case 'stats':
                element = document.querySelector('.match-info');
                break;
            default:
                console.error(`지원하지 않는 섹션: ${section}`);
                return false;
        }
        
        // 요소가 존재하는지 확인
        if (!element) {
            console.error(`${section} 요소를 찾을 수 없습니다.`);
            return false;
        }
        
        // 통계 섹션 토글 처리
        if (section === 'stats') {
            // 현재 표시 상태 확인
            const isVisible = element.style.display !== 'none';
            
            if (isVisible) {
                // 숨기기
                element.style.display = 'none';
                console.log('통계 섹션 숨김');
            } else {
                // 보이기
                element.style.display = 'flex';
                // 애니메이션 클래스 추가
                element.classList.add(this.animationClasses[section]);
                // 애니메이션 종료 후 클래스 제거
                setTimeout(() => {
                    element.classList.remove(this.animationClasses[section]);
                }, 500);
                console.log('통계 섹션 표시');
            }
            
            return true;
        }
        
        // 이전 애니메이션 클래스 제거
        element.classList.remove(this.animationClasses[section]);
        
        // 브라우저에게 "이전 클래스 제거가 끝났어"라고 인식시키는 트릭 (리플로우)
        void element.offsetWidth;
        
        // 애니메이션 클래스 다시 추가
        element.classList.add(this.animationClasses[section]);
        
        // 애니메이션 상태 업데이트
        this.animationStates[section] = true;
        
        // 애니메이션 종료 후 상태 업데이트
        setTimeout(() => {
            this.animationStates[section] = false;
        }, 1000);
        
        console.log(`${section} 애니메이션 실행됨`);
        return true;
    },
    
    /**
     * 모든 섹션의 애니메이션을 실행합니다.
     * @returns {boolean} - 모든 애니메이션 실행 성공 여부
     */
    playAllAnimations: function() {
        let success = true;
        for (const section in this.animationClasses) {
            if (!this.playAnimation(section)) {
                success = false;
            }
        }
        return success;
    },
    
    /**
     * 특정 섹션의 애니메이션을 중지합니다.
     * @param {string} section - 애니메이션을 중지할 섹션 이름
     * @returns {boolean} - 애니메이션 중지 성공 여부
     */
    stopAnimation: function(section) {
        // 섹션이 존재하는지 확인
        if (!this.animationClasses[section]) {
            console.error(`알 수 없는 섹션: ${section}`);
            return false;
        }
        
        // 해당 섹션의 요소 찾기
        let element;
        switch (section) {
            case 'scoreboard':
                element = document.querySelector('.scoreboard');
                break;
            case 'homeTeam':
                element = document.querySelector('.home-team');
                break;
            case 'awayTeam':
                element = document.querySelector('.away-team');
                break;
            case 'matchTime':
                element = document.querySelector('.match-time');
                break;
            case 'stats':
                element = document.querySelector('.match-info');
                break;
            default:
                console.error(`지원하지 않는 섹션: ${section}`);
                return false;
        }
        
        // 요소가 존재하는지 확인
        if (!element) {
            console.error(`${section} 요소를 찾을 수 없습니다.`);
            return false;
        }
        
        // 애니메이션 클래스 제거
        element.classList.remove(this.animationClasses[section]);
        
        // 애니메이션 상태 업데이트
        this.animationStates[section] = false;
        
        console.log(`${section} 애니메이션 중지됨`);
        return true;
    },
    
    /**
     * 모든 섹션의 애니메이션을 중지합니다.
     * @returns {boolean} - 모든 애니메이션 중지 성공 여부
     */
    stopAllAnimations: function() {
        let success = true;
        for (const section in this.animationClasses) {
            if (!this.stopAnimation(section)) {
                success = false;
            }
        }
        return success;
    }
};

// 소켓 이벤트 리스너 등록 (페이지 로드 시)
document.addEventListener('DOMContentLoaded', function() {
    // 소켓이 존재하는지 확인
    if (typeof io !== 'undefined' && typeof socket !== 'undefined') {
        // 애니메이션 이벤트 수신
        socket.on('animation', function(data) {
            console.log('애니메이션 이벤트 수신:', data);
            
            if (data.section) {
                // 특정 섹션 애니메이션 실행
                SoccerAnimationManager.playAnimation(data.section);
            } else if (data.all) {
                // 모든 섹션 애니메이션 실행
                SoccerAnimationManager.playAllAnimations();
            }
        });
        
        console.log('애니메이션 이벤트 리스너 등록됨');
    } else {
        console.warn('소켓이 정의되지 않아 애니메이션 이벤트 리스너를 등록할 수 없습니다.');
    }
});

// 전역 객체로 내보내기
window.SoccerAnimationManager = SoccerAnimationManager; 