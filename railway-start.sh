#!/bin/bash

echo "🚀 Railway PostgreSQL 데이터베이스 초기화 시작..."

# 데이터베이스 초기화 실행
node railway-db-init.js

# 초기화 성공 시 서버 시작
if [ $? -eq 0 ]; then
    echo "✅ 데이터베이스 초기화 완료 - 서버 시작"
    node server.js
else
    echo "❌ 데이터베이스 초기화 실패"
    exit 1
fi
