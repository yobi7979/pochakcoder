const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 백업 관련 라우터
// 이 파일은 server.js에서 분리된 백업 관련 API들을 포함합니다.

// GET /api/backup/list - 백업 목록 조회
router.get('/list', requireAuth, asyncHandler(async (req, res) => {
  try {
    const BackupRestoreManager = require('../backup-restore');
    const backupManager = new BackupRestoreManager();
    
    const backups = await backupManager.getBackupList();
    res.json(backups);
  } catch (error) {
    console.error('백업 목록 조회 실패:', error);
    res.status(500).json({ error: '백업 목록 조회에 실패했습니다.' });
  }
}));

// POST /api/backup/create - 새 백업 생성
router.post('/create', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { name } = req.body;
    
    const BackupRestoreManager = require('../backup-restore');
    const backupManager = new BackupRestoreManager();
    
    const backup = await backupManager.createBackup(name);
    res.json({ success: true, backup });
  } catch (error) {
    console.error('백업 생성 실패:', error);
    res.status(500).json({ error: '백업 생성에 실패했습니다.' });
  }
}));

// GET /api/backup/download/:fileName - 백업 다운로드
router.get('/download/:fileName', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { fileName } = req.params;
    
    const BackupRestoreManager = require('../backup-restore');
    const backupManager = new BackupRestoreManager();
    
    const backupPath = await backupManager.getBackupPath(fileName);
    res.download(backupPath, fileName);
  } catch (error) {
    console.error('백업 다운로드 실패:', error);
    res.status(500).json({ error: '백업 다운로드에 실패했습니다.' });
  }
}));

// POST /api/backup/restore - 백업 복원
router.post('/restore', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: '백업 파일명이 필요합니다.' });
    }
    
    const BackupRestoreManager = require('../backup-restore');
    const backupManager = new BackupRestoreManager();
    
    await backupManager.restoreBackup(fileName);
    res.json({ success: true, message: '백업이 복원되었습니다.' });
  } catch (error) {
    console.error('백업 복원 실패:', error);
    res.status(500).json({ error: '백업 복원에 실패했습니다.' });
  }
}));

// DELETE /api/backup/:fileName - 백업 삭제
router.delete('/:fileName', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { fileName } = req.params;
    
    const BackupRestoreManager = require('../backup-restore');
    const backupManager = new BackupRestoreManager();
    
    await backupManager.deleteBackup(fileName);
    res.json({ success: true, message: '백업이 삭제되었습니다.' });
  } catch (error) {
    console.error('백업 삭제 실패:', error);
    res.status(500).json({ error: '백업 삭제에 실패했습니다.' });
  }
}));

module.exports = router;
