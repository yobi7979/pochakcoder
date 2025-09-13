-- 기본 데이터 삽입 스크립트

-- 1. 기본 사용자 생성 (admin)
INSERT INTO "users" ("username", "password", "full_name", "role", "is_active") 
VALUES ('admin', '$2b$10$rQZ8k8k8k8k8k8k8k8k8kO', '시스템 관리자', 'admin', true)
ON CONFLICT ("username") DO NOTHING;

-- 2. 기본 템플릿 생성
INSERT INTO "templates" ("name", "sport_type", "template_type", "content", "is_default", "created_by") VALUES
('Soccer', 'soccer', 'control', '<div>축구 제어부</div>', true, 1),
('Soccer', 'soccer', 'overlay', '<div>축구 오버레이</div>', true, 1),
('Baseball', 'baseball', 'control', '<div>야구 제어부</div>', true, 1),
('Baseball', 'baseball', 'overlay', '<div>야구 오버레이</div>', true, 1),
('Volleyball', 'volleyball', 'control', '<div>배구 제어부</div>', true, 1),
('Volleyball', 'volleyball', 'overlay', '<div>배구 오버레이</div>', true, 1)
ON CONFLICT ("name", "template_type") DO NOTHING;

-- 3. 기본 종목 생성
INSERT INTO "Sports" ("name", "code", "template", "description", "is_active", "is_default", "created_by") VALUES
('축구', 'SOCCER', 'Soccer', '기본 축구 종목', true, true, 1),
('야구', 'BASEBALL', 'Baseball', '기본 야구 종목', true, true, 1),
('배구', 'VOLLEYBALL', 'Volleyball', '기본 배구 종목', true, true, 1)
ON CONFLICT ("code") DO NOTHING;

-- 4. 기본 설정 생성
INSERT INTO "Settings" ("key", "value", "description") VALUES
('default_sport', 'soccer', '기본 종목'),
('timer_enabled', 'true', '타이머 활성화'),
('auto_save', 'true', '자동 저장')
ON CONFLICT ("key") DO NOTHING;
