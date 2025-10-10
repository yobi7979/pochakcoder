// 헥스 색상을 RGB로 변환하는 헬퍼 함수
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// 파일 확장자 확인
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// 안전한 파일명 생성
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
}

// UUID 생성
function generateId() {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

// 현재 시간을 한국시간 기준 ISO 형식으로 반환
function getCurrentTimestamp() {
  const now = new Date();
  // 한국시간 (UTC+9)으로 변환
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString();
}

// 한국시간 기준으로 포맷된 시간 문자열 반환
function getKoreanTimeString() {
  const now = new Date();
  return now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 한국시간 기준으로 날짜만 반환
function getKoreanDateString() {
  const now = new Date();
  return now.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// 파일 크기를 읽기 쉬운 형식으로 변환
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 비밀번호 해시 (bcrypt 사용)
async function hashPassword(password) {
  const bcrypt = require('bcrypt');
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// 비밀번호 검증
async function verifyPassword(password, hashedPassword) {
  const bcrypt = require('bcrypt');
  return await bcrypt.compare(password, hashedPassword);
}

module.exports = {
  hexToRgb,
  getFileExtension,
  sanitizeFilename,
  generateId,
  getCurrentTimestamp,
  getKoreanTimeString,
  getKoreanDateString,
  formatFileSize,
  hashPassword,
  verifyPassword
};
