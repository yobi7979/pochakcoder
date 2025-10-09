# 🧪 WebSocket Room 테스트 가이드

## ✅ 구현 완료된 기능

### 🔧 서버 측 변경사항
- `routes/overlay-images.js`: `io.emit()` → `io.to('sport_${sportCode}').emit()` 변경
- 해당 종목의 Room에만 이벤트 전송

### 🔧 클라이언트 측 변경사항
- `views/soccer-template.ejs`: `socket.join('sport_${matchData.sport_type}')` 추가
- `views/baseball-template.ejs`: `socket.join('sport_${matchData.sport_type}')` 추가
- 하드코딩된 조건 → 동적 조건 비교로 변경

## 🧪 테스트 시나리오

### 📋 테스트 데이터
- **SOCCER 경기**: `1006SC5571` (축구1 vs 축구2)
- **K4 경기**: `10074168` (aa vs 축구2)
- **BASEBALL 경기**: `10072214` (강서 마곡리틀야구단 vs 홈팀입니다)

### 🎯 테스트 URL
1. **축구**: `http://localhost:3000/soccer/1006SC5571/overlay`
2. **K4**: `http://localhost:3000/k4/10074168/overlay`
3. **야구**: `http://localhost:3000/baseball/10072214/overlay`

### 🔍 확인 포인트

#### 1. 브라우저 콘솔에서 확인할 로그
```
🔧 종목별 Room 참여: sport_SOCCER
🔧 종목별 Room 참여: sport_K4
🔧 종목별 Room 참여: sport_BASEBALL
```

#### 2. 서버 로그에서 확인할 로그
```
🔧 WebSocket Room 전송: sport_SOCCER
🔧 WebSocket Room 전송: sport_K4
🔧 WebSocket Room 전송: sport_BASEBALL
```

### 🧪 테스트 단계

#### 1단계: 오버레이 페이지 열기
1. 브라우저에서 축구 오버레이 페이지 열기
2. 브라우저에서 K4 오버레이 페이지 열기
3. 브라우저에서 야구 오버레이 페이지 열기

#### 2단계: 설정 페이지에서 이미지 활성화/비활성화
1. 설정 페이지에서 축구 오버레이 이미지 활성화
2. 설정 페이지에서 K4 오버레이 이미지 활성화
3. 설정 페이지에서 야구 오버레이 이미지 활성화

#### 3단계: 실시간 반영 확인
1. 축구 오버레이 페이지에서만 축구 이미지 표시 확인
2. K4 오버레이 페이지에서만 K4 이미지 표시 확인
3. 야구 오버레이 페이지에서만 야구 이미지 표시 확인

#### 4단계: 독립성 확인
1. 축구 이미지 비활성화 시 K4, 야구 페이지에 영향 없음 확인
2. K4 이미지 비활성화 시 축구, 야구 페이지에 영향 없음 확인
3. 야구 이미지 비활성화 시 축구, K4 페이지에 영향 없음 확인

## ✅ 예상 결과

### 성공 시나리오
- 각 종목별로 독립적인 WebSocket Room 사용
- 해당 종목의 이벤트만 해당 종목 클라이언트에게 전송
- 다른 종목에 영향 없음
- 실시간 오버레이 이미지 표시/숨김 정상 작동

### 실패 시나리오
- 모든 클라이언트에게 이벤트 전송 (기존 문제)
- 다른 종목에 영향 있음
- 오버레이 이미지 실시간 반영 안됨

## 🎯 핵심 개선사항

1. **완전 동적 처리**: 새로운 종목/템플릿 추가 시 코드 수정 불필요
2. **네트워크 효율성**: 해당 종목 클라이언트에게만 전송
3. **유지보수성**: 하드코딩 완전 제거
4. **확장성**: 무제한 종목/템플릿 추가 가능

## 🔧 기술적 구현

### 서버 측
```javascript
// routes/overlay-images.js
io.to(`sport_${sportCode}`).emit('overlay_image_status_changed', {
    sportCode: sportCode,
    isActive: isActive,
    imageData: imageData,
    timestamp: new Date().toISOString()
});
```

### 클라이언트 측
```javascript
// 각 템플릿에서
socket.join(`sport_${matchData.sport_type}`);

socket.on('overlay_image_status_changed', function(data) {
    if (data.sportCode === matchData.sport_type) {
        // 해당 종목의 이벤트만 처리
    }
});
```

이제 브라우저에서 실제 테스트를 진행해보세요! 🚀
