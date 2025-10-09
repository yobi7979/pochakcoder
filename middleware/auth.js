// 인증 미들웨어
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
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
