-- Railway PostgreSQL 수동 스키마 수정 SQL
-- 이 SQL을 Railway Query 탭에서 직접 실행하세요

-- 1. 기존 Sports 테이블 삭제
DROP TABLE IF EXISTS "Sports" CASCADE;

-- 2. Sports 테이블 재생성 (created_by 컬럼 포함)
CREATE TABLE "Sports" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(255) NOT NULL UNIQUE,
    "template" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "is_default" BOOLEAN DEFAULT false,
    "created_by" INTEGER,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 기본 스포츠 데이터 삽입
INSERT INTO "Sports" ("name", "code", "template", "description", "is_active", "is_default", "created_by") 
VALUES 
    ('축구', 'SOCCER', 'soccer', '축구 경기', true, true, NULL),
    ('야구', 'BASEBALL', 'baseball', '야구 경기', true, true, NULL);

-- 4. 결과 확인
SELECT * FROM "Sports";
