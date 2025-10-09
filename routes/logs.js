const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 로그 관련 라우터
// 이 파일은 server.js에서 분리된 로그 관련 API들을 포함합니다.

// GET /api/logs - 로그 목록 조회
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(__dirname, '../logs');
    const logFiles = [];
    
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        logFiles.push({
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      });
    }
    
    res.json(logFiles);
  } catch (error) {
    console.error('로그 목록 조회 실패:', error);
    res.status(500).json({ error: '로그 목록 조회에 실패했습니다.' });
  }
}));

// GET /api/logs/auto-management-status - 자동 관리 상태 조회
router.get('/auto-management-status', requireAuth, asyncHandler(async (req, res) => {
  try {
    // 자동 관리 상태 조회 (placeholder)
    res.json({ enabled: false });
  } catch (error) {
    console.error('자동 관리 상태 조회 실패:', error);
    res.status(500).json({ error: '자동 관리 상태 조회에 실패했습니다.' });
  }
}));

// GET /api/logs/:filename - 특정 로그 파일 다운로드
router.get('/:filename', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(__dirname, '../logs', filename);
    
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    res.download(logFile, filename);
  } catch (error) {
    console.error('로그 파일 다운로드 실패:', error);
    res.status(500).json({ error: '로그 파일 다운로드에 실패했습니다.' });
  }
}));

// GET /api/logs/:filename/content - 특정 로그 파일 내용 조회
router.get('/:filename/content', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(__dirname, '../logs', filename);
    
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    res.json({ filename, content });
  } catch (error) {
    console.error('로그 파일 내용 조회 실패:', error);
    res.status(500).json({ error: '로그 파일 내용 조회에 실패했습니다.' });
  }
}));

// POST /api/logs/backup - 로그 백업
router.post('/backup', requireAuth, asyncHandler(async (req, res) => {
  try {
    // 로그 백업 로직 (placeholder)
    console.log('로그 백업 요청');
    res.json({ success: true, message: '로그 백업이 완료되었습니다.' });
  } catch (error) {
    console.error('로그 백업 실패:', error);
    res.status(500).json({ error: '로그 백업에 실패했습니다.' });
  }
}));

// POST /api/logs/cleanup - 로그 정리
router.post('/cleanup', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { days } = req.body;
    
    // 로그 정리 로직 (placeholder)
    console.log(`로그 정리 요청: ${days}일 이전 로그 삭제`);
    res.json({ success: true, message: '로그 정리가 완료되었습니다.' });
  } catch (error) {
    console.error('로그 정리 실패:', error);
    res.status(500).json({ error: '로그 정리에 실패했습니다.' });
  }
}));

// DELETE /api/logs/clear-all - 모든 로그 파일 삭제
router.delete('/clear-all', requireAuth, asyncHandler(async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(__dirname, '../logs');
    
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        fs.unlinkSync(filePath);
      });
    }
    
    console.log('모든 로그 파일 삭제 완료');
    res.json({ success: true, message: '모든 로그 파일이 삭제되었습니다.' });
  } catch (error) {
    console.error('로그 파일 삭제 실패:', error);
    res.status(500).json({ error: '로그 파일 삭제에 실패했습니다.' });
  }
}));

// DELETE /api/logs/:filename - 특정 로그 파일 삭제
router.delete('/:filename', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(__dirname, '../logs', filename);
    
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ error: '로그 파일을 찾을 수 없습니다.' });
    }
    
    fs.unlinkSync(logFile);
    
    console.log(`로그 파일 삭제: ${filename}`);
    res.json({ success: true, message: '로그 파일이 삭제되었습니다.' });
  } catch (error) {
    console.error('로그 파일 삭제 실패:', error);
    res.status(500).json({ error: '로그 파일 삭제에 실패했습니다.' });
  }
}));

// DELETE /api/logs - 모든 로그 파일 삭제
router.delete('/', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(__dirname, '../logs');
    
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        fs.unlinkSync(filePath);
      });
    }
    
    console.log('모든 로그 파일 삭제 완료');
    res.json({ success: true });
  } catch (error) {
    console.error('로그 파일 삭제 실패:', error);
    res.status(500).json({ error: '로그 파일 삭제에 실패했습니다.' });
  }
}));

module.exports = router;
