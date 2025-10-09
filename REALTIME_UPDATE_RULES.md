# 🔄 실시간 업데이트 개발 룰

## 📋 룰 개요
DB에 저장하는 형태의 코드 작성 시 오버레이 페이지에서 실시간으로 업데이트가 필요한 경우, 복잡한 소켓 통신 대신 단순한 DB 변경 알림 방식을 사용합니다.

## 🚨 필수 확인사항
**DB 저장 형태의 코드 작성 시 다음 질문을 반드시 확인하세요:**

1. **DB에 저장하는 API가 있는가?**
2. **오버레이 페이지에서 실시간 업데이트가 필요한가?**
3. **컨트롤 페이지에서 `dataChanged` 이벤트를 보내는가?**
4. **오버레이 페이지에서 `dataChanged` 이벤트를 받아 DB에서 데이터를 로드하는가?**

## ✅ 표준 개발 패턴

### 1. 컨트롤 페이지 (Control Page) 작성 규칙

#### ❌ 기존 방식 (복잡한 소켓 이벤트)
```javascript
// 복잡하고 유지보수가 어려운 방식
socket.emit('specificDataUpdated', {
    matchId: matchId,
    specificData: data,
    additionalInfo: info,
    timestamp: Date.now()
});
```

#### ✅ 새로운 방식 (단순한 DB 변경 알림)
```javascript
// 단순하고 유지보수가 쉬운 방식
socket.emit('dataChanged', {
    matchId: matchId,
    type: 'dataType',  // 예: 'teamColor', 'teamLogo', 'score', 'timer'
    teamType: teamType  // 필요한 경우만
});
```

### 2. 오버레이 페이지 (Template Page) 작성 규칙

#### ❌ 기존 방식 (복잡한 이벤트별 처리)
```javascript
// 각 기능별로 다른 소켓 이벤트 처리
socket.on('specificDataUpdated', function(data) {
    // 특정 데이터만 업데이트
    updateSpecificData(data);
});

socket.on('anotherDataUpdated', function(data) {
    // 또 다른 데이터 업데이트
    updateAnotherData(data);
});
```

#### ✅ 새로운 방식 (DB에서 최신 데이터 로드)
```javascript
// 통일된 방식으로 모든 데이터 업데이트
socket.on('dataChanged', async function(data) {
    if (data.matchId === matchId) {
        console.log(`✅ ${data.type} 데이터 변경 감지, DB에서 최신 데이터 로드 중...`);
        
        try {
            // DB에서 최신 데이터 로드
            await loadLatestDataFromDB();
            // UI 업데이트
            updateUI();
            console.log(`✅ ${data.type} 데이터 업데이트 완료`);
        } catch (error) {
            console.error(`❌ ${data.type} 데이터 업데이트 실패:`, error);
        }
    }
});
```

## 🎯 표준 패턴 예시

### 컨트롤 페이지 패턴
```javascript
async function saveDataToDB(data) {
    try {
        // 1. DB에 저장
        const response = await fetch('/api/endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            // 2. 소켓 이벤트로 변경 알림
            socket.emit('dataChanged', {
                matchId: matchId,
                type: 'dataType'
            });
            console.log('✅ 데이터 저장 및 변경 알림 완료');
        }
    } catch (error) {
        console.error('❌ 데이터 저장 실패:', error);
    }
}
```

### 오버레이 페이지 패턴
```javascript
socket.on('dataChanged', async function(data) {
    if (data.matchId === matchId) {
        console.log(`=== ${data.type} 데이터 변경 이벤트 수신 ===`);
        
        try {
            // DB에서 최신 데이터 로드
            await loadDataFromDB();
            // UI 업데이트
            updateUI();
        } catch (error) {
            console.error(`❌ ${data.type} 데이터 업데이트 실패:`, error);
        }
    }
});
```

## 📝 개발 체크리스트

### DB 저장 기능 개발 시
- [ ] DB에 저장하는 API 엔드포인트가 있는가?
- [ ] 컨트롤 페이지에서 `dataChanged` 이벤트를 보내는가?
- [ ] 오버레이 페이지에서 `dataChanged` 이벤트를 받는가?
- [ ] 오버레이 페이지에서 DB에서 최신 데이터를 로드하는가?

### 실시간 상태 변경 기능 개발 시
- [ ] DB에 저장하지 않는 실시간 상태 변경인가?
- [ ] 컨트롤 페이지에서 상태 변경 후 즉시 소켓 이벤트를 보내는가?
- [ ] 오버레이 페이지에서 해당 소켓 이벤트를 받아 즉시 UI를 업데이트하는가?
- [ ] 상태 변경이 일시적인가? (페이지 새로고침 시 초기화)

### 실시간 업데이트 기능 개발 시
- [ ] 복잡한 소켓 이벤트 대신 단순한 `dataChanged` 이벤트를 사용하는가?
- [ ] DB에서 직접 데이터를 로드하여 데이터 일관성을 보장하는가?
- [ ] 오류 발생 시 자동 복구가 가능한가?

## 🔄 실시간 상태 변경 기능 (DB 저장 없음)

### 팀로고 숨김/표시, 타이머 시작/정지 등 일시적 상태 변경

#### ✅ **실시간 상태 변경 패턴**
```javascript
// 컨트롤 페이지 - 상태 변경 후 즉시 소켓 이벤트 전송
function toggleTeamLogoVisibility() {
    const newState = !currentState;
    
    // 1. 로컬 상태 변경
    updateLocalState(newState);
    
    // 2. 즉시 소켓 이벤트 전송
    socket.emit('teamLogoVisibilityChanged', {
        matchId: matchId,
        useLogos: newState
    });
}

// 오버레이 페이지 - 소켓 이벤트 수신 시 즉시 UI 업데이트
socket.on('teamLogoVisibilityChanged', function(data) {
    if (data.matchId === matchId) {
        updateTeamLogoVisibility(data.useLogos);
    }
});
```

#### ❌ **DB 저장 방식과 혼동하지 말 것**
```javascript
// DB 저장 방식 (영구적 데이터)
socket.emit('dataChanged', { type: 'teamLogo' });

// 실시간 상태 변경 (일시적 상태)
socket.emit('teamLogoVisibilityChanged', { useLogos: true });
```

## 🔧 수정 가능한 경우 확인

**다음 상황에서 이 방법으로 수정 가능한지 확인하세요:**

1. **새로운 DB 저장 기능 추가 시**
   - 컨트롤 페이지에서 DB 저장 후 `dataChanged` 이벤트 전송
   - 오버레이 페이지에서 `dataChanged` 이벤트 수신 시 DB에서 데이터 로드

2. **실시간 상태 변경 기능 추가 시**
   - 컨트롤 페이지에서 상태 변경 후 즉시 소켓 이벤트 전송
   - 오버레이 페이지에서 소켓 이벤트 수신 시 즉시 UI 업데이트

3. **기존 복잡한 소켓 이벤트 수정 시**
   - 복잡한 소켓 이벤트를 `dataChanged` 이벤트로 통일
   - 오버레이 페이지에서 DB에서 직접 데이터 로드

4. **실시간 업데이트 문제 해결 시**
   - 소켓 통신 오류로 인한 데이터 불일치 문제
   - DB에서 직접 로드하여 데이터 일관성 보장

## 🚀 장점

### 1. **소켓 통신 단순화**
- 복잡한 이벤트별 처리 → 단일 `dataChanged` 이벤트
- 유지보수성 향상

### 2. **데이터 일관성 보장**
- 소켓 이벤트로 전달된 데이터 → DB에서 최신 데이터 직접 로드
- 항상 최신 상태 보장

### 3. **오류 복구 능력**
- 소켓 이벤트 실패 시 데이터 불일치 → DB에서 직접 로드하여 자동 복구
- 네트워크 오류 시에도 안정적

### 4. **확장성**
- 새로운 기능 추가 시 동일한 패턴 적용
- 일관된 개발 방식

## 📞 질문 및 확인

**이 방법으로 수정 가능한지 확인이 필요한 경우:**

1. **새로운 DB 저장 기능을 추가할 때**
2. **기존 복잡한 소켓 통신을 단순화할 때**
3. **실시간 업데이트 문제를 해결할 때**
4. **데이터 일관성 문제를 해결할 때**

**위 상황에서 이 룰을 참고하여 개발하거나, 수정 가능한지 확인이 필요한 경우 언제든지 질문하세요!**
