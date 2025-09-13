-- Railway PostgreSQL 테이블 생성 스크립트

-- 1. users 테이블
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR(50) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "email" VARCHAR(100),
    "full_name" VARCHAR(100),
    "role" VARCHAR(10) DEFAULT 'user' CHECK ("role" IN ('admin', 'user')),
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "last_login" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. templates 테이블
CREATE TABLE IF NOT EXISTS "templates" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "sport_type" VARCHAR(255) NOT NULL,
    "template_type" VARCHAR(10) NOT NULL CHECK ("template_type" IN ('control', 'overlay')),
    "content" TEXT NOT NULL,
    "file_name" VARCHAR(255),
    "is_default" BOOLEAN DEFAULT false,
    "created_by" INTEGER REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Sports 테이블
CREATE TABLE IF NOT EXISTS "Sports" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(255) UNIQUE NOT NULL,
    "template" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "is_default" BOOLEAN DEFAULT false,
    "created_by" INTEGER REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Matches 테이블
CREATE TABLE IF NOT EXISTS "Matches" (
    "id" VARCHAR(255) PRIMARY KEY,
    "sport_type" VARCHAR(255) NOT NULL,
    "home_team" VARCHAR(255) NOT NULL,
    "away_team" VARCHAR(255) NOT NULL,
    "home_team_color" VARCHAR(255) DEFAULT '#1e40af',
    "away_team_color" VARCHAR(255) DEFAULT '#1e40af',
    "home_team_header" VARCHAR(255) DEFAULT 'HOME',
    "away_team_header" VARCHAR(255) DEFAULT 'AWAY',
    "home_score" INTEGER DEFAULT 0,
    "away_score" INTEGER DEFAULT 0,
    "status" VARCHAR(255) DEFAULT 'pending',
    "match_data" JSONB DEFAULT '{}',
    "created_by" INTEGER REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Settings 테이블
CREATE TABLE IF NOT EXISTS "Settings" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(255) UNIQUE NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6. MatchLists 테이블
CREATE TABLE IF NOT EXISTS "MatchLists" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "matches" JSONB DEFAULT '[]',
    "custom_url" VARCHAR(255),
    "created_by" INTEGER REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. SportOverlayImages 테이블
CREATE TABLE IF NOT EXISTS "SportOverlayImages" (
    "id" SERIAL PRIMARY KEY,
    "sport_code" VARCHAR(255) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "upload_time" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. SportActiveOverlayImages 테이블
CREATE TABLE IF NOT EXISTS "SportActiveOverlayImages" (
    "id" SERIAL PRIMARY KEY,
    "sport_code" VARCHAR(255) UNIQUE NOT NULL,
    "active_image_id" INTEGER,
    "active_image_path" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "idx_sports_code" ON "Sports"("code");
CREATE INDEX IF NOT EXISTS "idx_matches_created_by" ON "Matches"("created_by");
CREATE INDEX IF NOT EXISTS "idx_sport_overlay_images_sport_code" ON "SportOverlayImages"("sport_code");
