// SportsCoder 통합 팀로고 선택 모달
// 모든 종목에서 사용할 수 있는 통합 팀로고 선택 시스템

class UnifiedTeamLogoModal {
    constructor(sportType, matchId, teamType) {
        this.sportType = sportType;
        this.matchId = matchId;
        this.teamType = teamType;
        this.availableLogos = [];
        this.selectedLogoId = null;
        this.modal = null;
    }
    
    // 모달 열기
    async open() {
        console.log(`🔧 통합 팀로고 모달 열기: ${this.sportType} - ${this.teamType}`);
        
        // 종목별 팀로고 목록 로드
        await this.loadAvailableLogos();
        
        // 모달 표시
        this.showModal();
    }
    
    // 사용 가능한 팀로고 목록 로드
    async loadAvailableLogos() {
        try {
            console.log(`🔧 팀로고 목록 로드: ${this.sportType}`);
            
            const response = await fetch(`/api/team-logos/${this.sportType}`);
            const result = await response.json();
            
            if (result.success) {
                this.availableLogos = result.teamLogos;
                console.log(`✅ 팀로고 목록 로드 완료: ${this.availableLogos.length}개`);
            } else {
                console.log('⚠️ 팀로고 목록 로드 실패');
                this.availableLogos = [];
            }
        } catch (error) {
            console.error('❌ 팀로고 목록 로드 실패:', error);
            this.availableLogos = [];
        }
    }
    
    // 모달 표시
    showModal() {
        // 기존 모달 제거
        this.close();
        
        // 모달 HTML 생성
        this.modal = document.createElement('div');
        this.modal.className = 'unified-team-logo-modal';
        this.modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${this.sportType} 팀로고 선택</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="logo-grid">
                            ${this.availableLogos.map(logo => `
                                <div class="logo-item" data-logo-id="${logo.id}">
                                    <div class="logo-image">
                                        <img src="${logo.logo_path}" alt="${logo.team_name}" onerror="this.style.display='none'">
                                    </div>
                                    <div class="logo-info">
                                        <span class="team-name">${logo.team_name}</span>
                                        <span class="logo-bg-color" style="background-color: ${logo.logo_bg_color}"></span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ${this.availableLogos.length === 0 ? '<div class="no-logos">사용 가능한 팀로고가 없습니다.</div>' : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel">취소</button>
                        <button class="btn-confirm" disabled>확인</button>
                    </div>
                </div>
            </div>
        `;
        
        // 스타일 추가
        this.addStyles();
        
        // DOM에 추가
        document.body.appendChild(this.modal);
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 애니메이션 효과
        setTimeout(() => {
            this.modal.classList.add('show');
        }, 10);
    }
    
    // 스타일 추가
    addStyles() {
        if (document.getElementById('unified-team-logo-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'unified-team-logo-modal-styles';
        style.textContent = `
            .unified-team-logo-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .unified-team-logo-modal.show {
                opacity: 1;
            }
            
            .unified-team-logo-modal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .unified-team-logo-modal .modal-content {
                background: white;
                border-radius: 8px;
                max-width: 800px;
                width: 100%;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            
            .unified-team-logo-modal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .unified-team-logo-modal .modal-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: bold;
            }
            
            .unified-team-logo-modal .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            
            .unified-team-logo-modal .modal-body {
                padding: 20px;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .unified-team-logo-modal .logo-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
            }
            
            .unified-team-logo-modal .logo-item {
                border: 2px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .unified-team-logo-modal .logo-item:hover {
                border-color: #007bff;
                transform: translateY(-2px);
            }
            
            .unified-team-logo-modal .logo-item.selected {
                border-color: #007bff;
                background-color: #f8f9ff;
            }
            
            .unified-team-logo-modal .logo-image {
                width: 60px;
                height: 60px;
                margin: 0 auto 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .unified-team-logo-modal .logo-image img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }
            
            .unified-team-logo-modal .logo-info {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .unified-team-logo-modal .team-name {
                font-weight: bold;
                font-size: 14px;
            }
            
            .unified-team-logo-modal .logo-bg-color {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                margin: 0 auto;
                border: 1px solid #ddd;
            }
            
            .unified-team-logo-modal .no-logos {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 40px;
            }
            
            .unified-team-logo-modal .modal-footer {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .unified-team-logo-modal .btn-cancel,
            .unified-team-logo-modal .btn-confirm {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .unified-team-logo-modal .btn-cancel {
                background-color: #6c757d;
                color: white;
            }
            
            .unified-team-logo-modal .btn-confirm {
                background-color: #007bff;
                color: white;
            }
            
            .unified-team-logo-modal .btn-confirm:disabled {
                background-color: #ccc;
                cursor: not-allowed;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 로고 선택 이벤트
        this.modal.querySelectorAll('.logo-item').forEach(item => {
            item.addEventListener('click', () => {
                // 기존 선택 해제
                this.modal.querySelectorAll('.logo-item').forEach(i => i.classList.remove('selected'));
                
                // 새 선택
                item.classList.add('selected');
                this.selectedLogoId = item.dataset.logoId;
                
                // 확인 버튼 활성화
                const confirmBtn = this.modal.querySelector('.btn-confirm');
                confirmBtn.disabled = false;
            });
        });
        
        // 확인 버튼
        this.modal.querySelector('.btn-confirm').addEventListener('click', () => {
            if (this.selectedLogoId) {
                this.selectLogo(this.selectedLogoId);
            }
            this.close();
        });
        
        // 취소 버튼
        this.modal.querySelector('.btn-cancel').addEventListener('click', () => {
            this.close();
        });
        
        // 닫기 버튼
        this.modal.querySelector('.close-btn').addEventListener('click', () => {
            this.close();
        });
        
        // 오버레이 클릭 시 닫기
        this.modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.close();
            }
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal) {
                this.close();
            }
        });
    }
    
    // 팀로고 선택
    async selectLogo(logoId) {
        try {
            console.log(`🔧 팀로고 선택: ${this.teamType} - ${logoId}`);
            
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
                const result = await response.json();
                if (result.success) {
                    console.log(`✅ 팀로고 선택 완료: ${this.teamType} - ${logoId}`);
                    
                    // WebSocket으로 다른 클라이언트에게 알림
                    if (typeof socket !== 'undefined') {
                        socket.emit('teamLogoUpdated', {
                            matchId: this.matchId,
                            teamType: this.teamType,
                            logoId: logoId
                        });
                    }
                    
                    // 성공 메시지 표시
                    this.showSuccessMessage();
                } else {
                    console.error('❌ 팀로고 선택 실패:', result.message);
                    this.showErrorMessage(result.message || '팀로고 선택에 실패했습니다.');
                }
            } else {
                console.error('❌ 팀로고 선택 API 오류:', response.status);
                this.showErrorMessage('서버 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('❌ 팀로고 선택 실패:', error);
            this.showErrorMessage('팀로고 선택 중 오류가 발생했습니다.');
        }
    }
    
    // 성공 메시지 표시
    showSuccessMessage() {
        // 간단한 토스트 메시지
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10001;
        `;
        toast.textContent = '팀로고가 성공적으로 설정되었습니다.';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }
    
    // 오류 메시지 표시
    showErrorMessage(message) {
        // 간단한 토스트 메시지
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #dc3545;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10001;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }
    
    // 모달 닫기
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
            setTimeout(() => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.parentNode.removeChild(this.modal);
                }
                this.modal = null;
            }, 300);
        }
    }
}

// 전역 함수로 노출
window.UnifiedTeamLogoModal = UnifiedTeamLogoModal;

// 편의 함수
window.openUnifiedLogoModal = function(teamType) {
    const sportType = window.sportType || 'SOCCER';
    const matchId = window.matchId;
    
    if (!matchId) {
        console.error('❌ 경기 ID를 찾을 수 없습니다.');
        return;
    }
    
    const modal = new UnifiedTeamLogoModal(sportType, matchId, teamType);
    modal.open();
};
