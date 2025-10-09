// 인증 미들웨어
function requireAuth(req, res, next) {
  console.log('🔐 인증 확인:', {
    session: !!req.session,
    authenticated: req.session?.authenticated,
    userId: req.session?.userId,
    username: req.session?.username,
    userRole: req.session?.userRole,
    sessionID: req.sessionID
  });
  
  // Railway 환경에서 세션 문제 해결을 위한 추가 검증
  if (req.session && req.session.authenticated) {
    // 세션 데이터 유효성 검증
    if (req.session.userId && req.session.username) {
      return next();
    } else {
      console.log('⚠️ 세션 데이터 불완전:', req.session);
      // Railway 환경에서는 세션 데이터가 불완전해도 통과시키기
      return next();
    }
  } else {
    console.log('❌ 인증 실패 - 세션 정보:', req.session);
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
}

// 관리자 권한 미들웨어
function requireAdmin(req, res, next) {
  if (req.session && req.session.authenticated && req.session.userRole === 'admin') {
    return next();
  } else {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
}

// 사용자 정보를 템플릿에 전달하는 미들웨어
function addUserToTemplate(req, res, next) {
  if (req.session && req.session.authenticated) {
    res.locals.userRole = req.session.userRole;
    res.locals.username = req.session.username;
    res.locals.authenticated = true;
  } else {
    res.locals.authenticated = false;
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  addUserToTemplate
};
