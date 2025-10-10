const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들 (모든 환경에서 Sequelize 사용)
let User = null;
try {
  User = require('../models').User;
  console.log('🔧 Sequelize User 모델 로딩 성공');
} catch (error) {
  console.log('Sequelize 모델 로딩 실패:', error.message);
}

// 인증 관련 라우터
// 이 파일은 server.js에서 분리된 인증 관련 API들을 포함합니다.

// GET /login - 로그인 페이지
router.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/matches');
  }
  res.render('login', { error: null });
});

// POST /login - 로그인 처리
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  
  try {
    console.log(`로그인 시도: ${username}`);
    
    // 입력값 검증
    if (!username || !password) {
      console.warn('로그인 실패: 사용자명 또는 비밀번호가 비어있음');
      return res.render('login', { 
        error: '사용자명과 비밀번호를 입력해주세요.',
        username: username 
      });
    }
    
    // 모든 환경에서 Sequelize 사용
    let user = null;
    
    if (User) {
      user = await User.findOne({ 
        where: { 
          username: username,
          is_active: true 
        } 
      });
    } else {
      console.error('User 모델이 로딩되지 않음');
      return res.render('login', { 
        error: '데이터베이스 모델 로딩 오류가 발생했습니다.',
        username: username 
      });
    }
    
    console.log(`사용자 조회 결과: ${user ? '존재' : '없음'}`);
    
    if (user) {
      // bcrypt로 비밀번호 비교
      const bcrypt = require('bcrypt');
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (isPasswordValid) {
        // 로그인 성공
        req.session.authenticated = true;
        req.session.username = username;
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        // 세션 저장 확인
        req.session.save((err) => {
          if (err) {
            console.error('세션 저장 실패:', err);
            return res.render('login', { 
              error: '세션 저장에 실패했습니다.',
              username: username 
            });
          }
          
          console.log(`사용자 로그인 성공: ${username} (${user.role})`);
          
          // 마지막 로그인 시간 업데이트
          user.update({ last_login: new Date() }).catch(err => {
            console.error('로그인 시간 업데이트 실패:', err);
          });
          
          // Railway 환경에서 절대 URL로 리다이렉트
          let redirectUrl = '/matches';
          
          // Railway 환경에서 절대 URL 사용
          if (process.env.RAILWAY_PUBLIC_DOMAIN) {
            redirectUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/matches`;
          } else if (process.env.RAILWAY_STATIC_URL) {
            redirectUrl = `${process.env.RAILWAY_STATIC_URL}/matches`;
          } else if (req.get('host')) {
            const protocol = req.secure ? 'https' : 'http';
            redirectUrl = `${protocol}://${req.get('host')}/matches`;
          }
          
          console.log(`리다이렉트 URL: ${redirectUrl}`);
          return res.redirect(302, redirectUrl);
        });
      } else {
        // 비밀번호 불일치
        console.warn(`로그인 실패: 비밀번호 불일치 - ${username}`);
        return res.render('login', { 
          error: '사용자명 또는 비밀번호가 올바르지 않습니다.',
          username: username 
        });
      }
    } else {
      // 사용자 없음
      console.warn(`로그인 실패: 사용자 없음 - ${username}`);
      return res.render('login', { 
        error: '사용자명 또는 비밀번호가 올바르지 않습니다.',
        username: username 
      });
    }
  } catch (error) {
    console.error('로그인 처리 중 오류:', error);
    
    // 에러 타입별 처리
    if (error.name === 'SequelizeConnectionError') {
      res.render('login', { 
        error: '데이터베이스 연결 오류가 발생했습니다.',
        username: username 
      });
    } else if (error.name === 'SequelizeValidationError') {
      res.render('login', { 
        error: '입력값이 올바르지 않습니다.',
        username: username 
      });
    } else {
      res.render('login', { 
        error: '로그인 처리 중 오류가 발생했습니다.',
        username: username 
      });
    }
  }
}));

// GET /logout - 로그아웃 처리
router.get('/logout', (req, res) => {
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      console.error('세션 삭제 오류:', err);
    } else {
      console.log(`사용자 로그아웃: ${username}`);
    }
    res.redirect('/login');
  });
});

// GET /api/auth/check - 인증 상태 확인
router.get('/check', asyncHandler(async (req, res) => {
  try {
    if (req.session && req.session.authenticated) {
      res.json({ 
        authenticated: true, 
        username: req.session.username,
        userId: req.session.userId,
        userRole: req.session.userRole
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    console.error('인증 상태 확인 실패:', error);
    res.status(500).json({ error: '인증 상태 확인에 실패했습니다.' });
  }
}));

module.exports = router;
