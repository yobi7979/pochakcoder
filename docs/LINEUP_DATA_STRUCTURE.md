# 라인업 데이터 구조 문서

## 📋 **라인업 데이터 저장 위치**

### **테이블**: `Matches`
### **컬럼**: `match_data` (JSON)
### **경로**: `match_data.lineup`

## 🏗️ **데이터 구조**

```json
{
  "match_data": {
    "lineup": {
      "home": [
        {
          "number": "1",
          "name": "이승엽",
          "position": "GK"
        },
        {
          "number": "2",
          "name": "김철수",
          "position": "DF"
        },
        {
          "number": "3",
          "name": "박민수",
          "position": "MF"
        },
        {
          "number": "4",
          "name": "정우진",
          "position": "FW"
        }
      ],
      "away": [
        {
          "number": "1",
          "name": "김골키",
          "position": "GK"
        },
        {
          "number": "2",
          "name": "이수비",
          "position": "DF"
        },
        {
          "number": "3",
          "name": "박미드",
          "position": "MF"
        },
        {
          "number": "4",
          "name": "정공격",
          "position": "FW"
        }
      ]
    }
  }
}
```

## 🔧 **API 엔드포인트**

### **1. 라인업 조회**
- **URL**: `GET /api/matches/:matchId/load-lineup`
- **응답**: `{ success: true, lineup: { home: [], away: [] } }`

### **2. 전체 라인업 저장**
- **URL**: `POST /api/matches/save-lineup`
- **요청**: `{ matchId: "123", lineup: { home: [], away: [] } }`
- **응답**: `{ success: true }`

### **3. 개별 팀 라인업 저장**
- **URL**: `POST /api/matches/:matchId/save-lineup`
- **요청**: `{ teamType: "home", lineup: [] }`
- **응답**: `{ success: true }`

## 📝 **입력 형식**

### **컨트롤 페이지 입력**
```
1 이승엽 GK
2 김철수 DF
3 박민수 MF
4 정우진 FW
```

### **파싱 결과**
```javascript
[
  { number: "1", name: "이승엽", position: "GK" },
  { number: "2", name: "김철수", position: "DF" },
  { number: "3", name: "박민수", position: "MF" },
  { number: "4", name: "정우진", position: "FW" }
]
```

## 🎯 **포지션 코드**

- **GK**: 골키퍼
- **DF**: 수비수
- **MF**: 미드필더
- **FW**: 공격수

## 💾 **저장 방식**

1. **개별 팀 저장**: 홈팀 또는 어웨이팀만 저장
2. **전체 저장**: 홈팀과 어웨이팀 동시 저장
3. **데이터 검증**: 번호, 이름, 포지션 필수 입력
4. **중복 방지**: 기존 라인업 데이터 유지

## 🔄 **데이터 흐름**

1. **입력**: 컨트롤 페이지에서 텍스트 입력
2. **파싱**: JavaScript로 배열 형태로 변환
3. **검증**: 필수 필드 확인
4. **저장**: API를 통해 match_data.lineup에 저장
5. **조회**: 오버레이 페이지에서 라인업 표시

## 📊 **데이터베이스 스키마**

```sql
-- Matches 테이블
CREATE TABLE Matches (
  id INTEGER PRIMARY KEY,
  match_data JSON,  -- 라인업 데이터 저장
  ...
);
```

## 🚀 **사용 예시**

### **라인업 저장**
```javascript
// 전체 라인업 저장
const lineup = {
  home: [
    { number: "1", name: "이승엽", position: "GK" },
    { number: "2", name: "김철수", position: "DF" }
  ],
  away: [
    { number: "1", name: "김골키", position: "GK" },
    { number: "2", name: "이수비", position: "DF" }
  ]
};

await fetch('/api/matches/save-lineup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ matchId: '123', lineup })
});
```

### **라인업 조회**
```javascript
const response = await fetch('/api/matches/123/load-lineup');
const { success, lineup } = await response.json();

if (success) {
  console.log('홈팀 라인업:', lineup.home);
  console.log('어웨이팀 라인업:', lineup.away);
}
```
