const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { User, UserSportPermission } = require('../models');
const { Op } = require('sequelize');

// 사용자 관련 라우터
// 이 파일은 server.js에서 분리된 사용자 관련 API들을 포함합니다.

// GET /api/users - 모든 사용자 조회
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'full_name', 'role'],
      where: { is_active: true },
      order: [['username', 'ASC']]
    });
    
    res.json(users);
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}));

// GET /api/users/:id - 특정 사용자 조회
router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json(user);
  } catch (error) {
    console.error('사용자 조회 실패:', error);
    res.status(500).json({ error: '사용자 조회에 실패했습니다.' });
  }
}));

// POST /api/users - 새 사용자 생성
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    
    // 중복 사용자명 확인
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
    }
    
    // 새 사용자 생성
    const newUser = await User.create({
      username,
      password, // 실제 운영에서는 해싱 필요
      full_name,
      email,
      role: role || 'user'
    });
    
    console.log(`새 사용자 생성: ${username}`);
    res.json({ success: true, user: newUser });
  } catch (error) {
    console.error('사용자 생성 실패:', error);
    res.status(500).json({ error: '사용자 생성에 실패했습니다.' });
  }
}));

// PUT /api/users/:id - 사용자 수정
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { username, password, full_name, email, role, is_active } = req.body;
    const userId = req.params.id;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 사용자명 중복 확인 (자기 자신 제외)
    if (username !== user.username) {
      const existingUser = await User.findOne({ 
        where: { 
          username,
          id: { [Op.ne]: userId }
        } 
      });
      if (existingUser) {
        return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
      }
    }
    
    // 업데이트할 데이터 준비
    const updateData = {
      username,
      full_name,
      email,
      role,
      is_active
    };
    
    // 비밀번호가 제공된 경우에만 업데이트
    if (password && password.trim() !== '') {
      updateData.password = password; // 실제 운영에서는 해싱 필요
    }
    
    await user.update(updateData);
    
    console.log(`사용자 정보 수정: ${username}`);
    res.json({ success: true, user });
  } catch (error) {
    console.error('사용자 수정 실패:', error);
    res.status(500).json({ error: '사용자 수정에 실패했습니다.' });
  }
}));

// DELETE /api/users/:id - 사용자 삭제
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 관리자 권한 확인 (마지막 관리자는 삭제 불가)
    if (user.role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '마지막 관리자는 삭제할 수 없습니다.' });
      }
    }
    
    await user.destroy();
    
    console.log(`사용자 삭제: ${user.username}`);
    res.json({ success: true });
  } catch (error) {
    console.error('사용자 삭제 실패:', error);
    res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
  }
}));

module.exports = router;
