# SportsCoder - 스포츠 경기 실시간 오버레이 시스템

스포츠 경기의 실시간 데이터를 시각적으로 표시하는 오버레이 시스템입니다. 야구, 축구 등 다양한 스포츠를 지원하며, 실시간으로 경기 상황을 업데이트할 수 있습니다.

## 🚀 주요 기능

### 야구 오버레이
- **실시간 스코어보드**: 홈팀/원정팀 점수 표시
- **베이스 상태**: 1루, 2루, 3루 주자 상태 시각화
- **게임 상태**: 볼/스트라이크/아웃 카운트
- **이닝 정보**: 현재 이닝 및 초/말 표시
- **선수 정보**: 타자/투수 상세 정보 (숨김 처리됨)
- **이닝 스코어**: 1~9이닝별 점수 (숨김 처리됨)

### 축구 오버레이
- **실시간 스코어보드**: 홈팀/원정팀 점수 표시
- **경기 시간**: 타이머 기능
- **경기 상태**: 전/후반, 연장전 등
- **팀 통계**: 슈팅, 코너킥, 파울 등

### 공통 기능
- **실시간 업데이트**: Socket.IO를 통한 실시간 데이터 동기화
- **팀 로고 관리**: 팀별 로고 업로드 및 관리
- **팀 색상 커스터마이징**: 팀별 색상 설정
- **선수 데이터 관리**: CSV 파일을 통한 선수 정보 관리

## 🛠️ 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite (Sequelize ORM)
- **Real-time**: Socket.IO
- **Frontend**: EJS, HTML5, CSS3, JavaScript
- **File Upload**: Multer
- **Logging**: Winston

## 📦 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/yobi7979/sportscoder.git
cd sportscoder
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 서버 실행
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 4. 접속
- **메인 페이지**: http://localhost:3000
- **야구 컨트롤**: http://localhost:3000/baseball/{match_id}/control
- **야구 오버레이**: http://localhost:3000/baseball/{match_id}/overlay
- **축구 컨트롤**: http://localhost:3000/soccer/{match_id}/control
- **축구 오버레이**: http://localhost:3000/soccer/{match_id}/overlay

## 📁 프로젝트 구조

```
SportsCoder/
├── server.js              # 메인 서버 파일
├── package.json           # 프로젝트 설정
├── views/                 # EJS 템플릿 파일들
│   ├── baseball-template.ejs    # 야구 오버레이 템플릿
│   ├── baseball-control.ejs     # 야구 컨트롤 페이지
│   ├── soccer-template.ejs      # 축구 오버레이 템플릿
│   └── soccer-control.ejs       # 축구 컨트롤 페이지
├── models/                # 데이터베이스 모델
├── public/                # 정적 파일들
│   ├── TEAMLOGO/          # 팀 로고 파일들
│   └── css/               # 스타일시트
├── Data/                  # 선수 데이터 파일들
└── templates/             # 추가 템플릿 파일들
```

## 🎮 사용 방법

### 1. 경기 생성
1. 메인 페이지에서 "새 경기 만들기" 클릭
2. 스포츠 종목 선택 (야구/축구)
3. 홈팀/원정팀 이름 입력
4. 경기 생성

### 2. 오버레이 설정
1. 컨트롤 페이지에서 경기 정보 입력
2. 팀 로고 업로드 (선택사항)
3. 팀 색상 설정
4. 실시간으로 오버레이에 반영

### 3. 선수 데이터 관리 (야구)
1. CSV 파일로 선수 정보 업로드
2. 현재 타자/투수 선택
3. 실시간 선수 정보 표시

## 🔧 API 엔드포인트

### 경기 관리
- `GET /matches` - 경기 목록 조회
- `POST /api/match` - 새 경기 생성
- `PUT /api/match/:id` - 경기 정보 업데이트
- `DELETE /api/match/:id` - 경기 삭제

### 팀 관리
- `POST /api/team-logo` - 팀 로고 업로드
- `POST /api/update-team-logo-map` - 팀 로고 맵 업데이트
- `POST /api/update-team-color` - 팀 색상 업데이트

### 선수 데이터
- `POST /api/upload-player-data` - 선수 데이터 업로드
- `POST /api/update-current-players` - 현재 선수 업데이트

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 GitHub Issues를 통해 연락해주세요.

---

**SportsCoder** - 스포츠 경기를 더욱 생생하게! 