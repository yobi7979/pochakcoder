# SportsCoder 템플릿과 종목 구조 완전 분석

## 📊 전체 아키텍처 구조

```
SportsCoder 프로젝트
├── 📁 데이터베이스 모델 (models/)
│   ├── Sport.js          # 종목 정보
│   ├── Template.js       # 템플릿 정보  
│   ├── Match.js          # 경기 정보
│   └── User.js           # 사용자 정보
├── 📁 뷰 템플릿 (views/)
│   ├── 기본 템플릿 (*-template.ejs)
│   ├── 컨트롤 페이지 (*-control*.ejs)
│   └── 기타 페이지
└── 📁 API 라우터 (routes/)
    ├── sports.js         # 종목 관리
    ├── templates.js     # 템플릿 관리
    └── matches.js       # 경기 관리
```

## 🎯 종목(Sport) 구조

### 데이터베이스 모델 (Sport.js)
```javascript
Sport {
  id: INTEGER (PK, 자동증가)
  name: STRING (종목명, 예: "축구", "야구")
  code: STRING (종목코드, 예: "SOCCER", "BASEBALL") - UNIQUE
  template: STRING (사용할 템플릿, 예: "soccer", "baseball")
  description: TEXT (설명)
  is_active: BOOLEAN (활성화 여부)
  is_default: BOOLEAN (기본 종목 여부)
  created_by: INTEGER (생성자 ID)
}
```

### 종목 생성 과정
1. **사용자 입력**: 종목명, 종목코드, 템플릿 선택
2. **폴더 생성**: `public/overlay-images/{종목코드}/` 자동 생성
3. **DB 저장**: Sports 테이블에 종목 정보 저장
4. **관련 데이터**: 오버레이 이미지, 경기 데이터와 연결

## 🎨 템플릿(Template) 구조

### 데이터베이스 모델 (Template.js)
```javascript
Template {
  id: INTEGER (PK, 자동증가)
  name: STRING (템플릿명)
  sport_type: STRING (종목 타입)
  template_type: ENUM('control', 'overlay') (템플릿 유형)
  content: TEXT (템플릿 내용)
  file_name: STRING (파일명)
  is_default: BOOLEAN (기본 템플릿 여부)
  created_by: STRING (생성자)
}
```

### 템플릿 유형
1. **기본 템플릿 (Base Templates)**
   - `soccer-template.ejs` → 축구 오버레이
   - `baseball-template.ejs` → 야구 오버레이
   - 파일 시스템에서 자동 감지

2. **등록된 템플릿 (Registered Templates)**
   - 사용자가 생성한 커스텀 템플릿
   - 데이터베이스에 저장

## 🔄 템플릿과 종목의 관계

### 1:N 관계
```
Sport (종목) 1 ───── N Template (템플릿)
```

- **하나의 종목**은 **여러 템플릿**을 가질 수 있음
- **종목의 `template` 필드**는 **기본 템플릿**을 지정
- **경기 생성 시** 해당 종목의 템플릿을 사용

### 실제 연결 과정
1. **종목 생성** → `template: "soccer"` 설정
2. **경기 생성** → `sport_type: "SOCCER"` 설정  
3. **오버레이 표시** → `soccer-template.ejs` 사용
4. **컨트롤 페이지** → `soccer-control.ejs` 사용

## 📁 파일 구조 매핑

### 기본 템플릿 파일
```
views/
├── soccer-template.ejs      # 축구 오버레이
├── baseball-template.ejs    # 야구 오버레이
├── soccer-control.ejs       # 축구 컨트롤
├── baseball-control.ejs     # 야구 컨트롤
├── soccer-control-mobile.ejs # 축구 모바일 컨트롤
└── baseball-control-mobile.ejs # 야구 모바일 컨트롤
```

### 오버레이 이미지 구조
```
public/overlay-images/
├── SOCCER/                   # 축구 종목 이미지
│   ├── 이미지1.png
│   └── 이미지2.png
├── BASEBALL/                 # 야구 종목 이미지
│   ├── 이미지1.png
│   └── 이미지2.png
└── {종목코드}/               # 사용자 생성 종목
    └── 이미지들...
```

## 🔧 API 구조

### 종목 관련 API
```javascript
GET    /api/sport              # 종목 목록
POST   /api/sport              # 종목 생성
PUT    /api/sport/:code         # 종목 수정
DELETE /api/sport/:code         # 종목 삭제
```

### 템플릿 관련 API
```javascript
GET    /api/templates           # 등록된 템플릿 목록
GET    /api/base-templates      # 기본 템플릿 목록
POST   /api/templates           # 템플릿 생성
PUT    /api/templates/:id       # 템플릿 수정
DELETE /api/templates/:id       # 템플릿 삭제
```

## 🎯 실제 사용 흐름

### 새 종목 생성 시
1. 사용자가 종목명, 코드, 템플릿 선택
2. `POST /api/sport` 호출
3. `public/overlay-images/{종목코드}/` 폴더 생성
4. Sports 테이블에 종목 정보 저장

### 새 템플릿 생성 시
1. 사용자가 기본 템플릿 선택 (축구/야구)
2. 템플릿 내용 수정
3. `POST /api/templates` 호출
4. Templates 테이블에 템플릿 저장

### 경기 생성 시
1. 종목 선택 → 해당 종목의 템플릿 사용
2. 경기 정보 입력
3. `POST /api/matches` 호출
4. Matches 테이블에 경기 저장

## 🔍 현재 문제점과 해결책

### 문제: 기본 템플릿이 드롭박스에 표시되지 않음
### 원인: 
- API 응답이 304 (Not Modified)로 캐시됨
- 파일 시스템에서 기본 템플릿 감지 실패

### 해결책:
- 캐시 방지 헤더 추가
- 디버깅 로그로 파일 감지 과정 확인
- 프론트엔드에서 API 응답 처리 개선

## 📋 핵심 특징

1. **유연한 구조**: 종목과 템플릿이 독립적으로 관리
2. **자동 폴더 생성**: 종목 생성 시 오버레이 이미지 폴더 자동 생성
3. **템플릿 재사용**: 기본 템플릿을 기반으로 커스텀 템플릿 생성
4. **실시간 업데이트**: WebSocket을 통한 실시간 데이터 동기화
5. **모바일 지원**: 각 종목별 모바일 컨트롤 페이지 제공

## 🧪 테스트 시나리오

### 1. 기본 템플릿 표시 테스트
- 템플릿 관리 페이지 접속
- "새 템플릿" 버튼 클릭
- "기본 템플릿" 드롭박스에 "축구 템플릿", "야구 템플릿" 표시 확인

### 2. 종목 생성 테스트
- 종목 관리 페이지에서 새 종목 생성
- 종목명, 코드, 템플릿 선택
- 폴더 자동 생성 확인

### 3. 템플릿 생성 테스트
- 기본 템플릿 선택 후 새 템플릿 생성
- 템플릿 내용 수정 및 저장
- 생성된 템플릿이 목록에 표시되는지 확인

### 4. 경기 생성 테스트
- 경기 생성 시 종목 선택
- 해당 종목의 템플릿이 자동으로 적용되는지 확인
