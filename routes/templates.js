const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 모델들
const { Template } = require('../models');
const path = require('path');
const fs = require('fs');
const fsSync = require('fs');

// 템플릿 관련 라우터
// 이 파일은 server.js에서 분리된 템플릿 관련 API들을 포함합니다.

// GET /api/templates - 모든 템플릿 조회
router.get('/', asyncHandler(async (req, res) => {
  try {
    const templates = await Template.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(templates);
  } catch (error) {
    console.error('템플릿 조회 실패:', error);
    res.status(500).json({ error: '템플릿 조회에 실패했습니다.' });
  }
}));

// GET /api/templates/base-templates - 기본 템플릿 조회
router.get('/base-templates', requireAuth, async (req, res) => {
  try {
    const viewsDir = path.join(__dirname, '../views');
    
    const templates = [];
    
    // views 폴더의 기본 템플릿들 (soccer, baseball만 기본 템플릿으로 인식)
    if (fs.existsSync(viewsDir)) {
      const viewFiles = fs.readdirSync(viewsDir);
      const registeredTemplates = viewFiles
        .filter(file => {
          const name = file.replace('-template.ejs', '');
          // soccer와 baseball만 기본 템플릿으로 인식
          return file.endsWith('-template.ejs') && (name === 'soccer' || name === 'baseball');
        })
        .map(file => {
          const name = file.replace('-template.ejs', '');
          const displayName = name.charAt(0).toUpperCase() + name.slice(1);
          return {
            filename: file,
            name: name,
            displayName: displayName,
            path: `/views/${file}`,
            type: 'base'  // 기본 템플릿으로 설정
          };
        });
      templates.push(...registeredTemplates);
    }
    
    // 이름순으로 정렬
    templates.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // 캐시 방지 헤더 추가
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({ success: true, templates: templates });
  } catch (error) {
    console.error('기본 템플릿 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// POST /api/templates - 새 템플릿 생성
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { name, baseTemplate } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '템플릿 이름은 필수입니다.' });
    }

    // 이름 중복 확인
    const existingTemplate = await Template.findOne({ where: { name } });
    if (existingTemplate) {
      return res.status(400).json({ error: '이미 존재하는 템플릿 이름입니다.' });
    }

    // 기본 템플릿 파일들을 복사하여 새 템플릿 생성
    const viewsDir = path.join(__dirname, '../views');
    const templateDir = path.join(__dirname, '../template');
    
    // 기본 템플릿이 지정된 경우 해당 템플릿 사용, 아니면 soccer 기본값 사용
    const baseTemplateName = baseTemplate || 'soccer';
    
    // 기본 템플릿 파일 경로 확인 (template 폴더 또는 views 폴더)
    let baseTemplateFile = path.join(templateDir, `${baseTemplateName}-template.html`);
    let baseControlFile = path.join(viewsDir, `${baseTemplateName}-control.ejs`);
    let baseControlMobileFile = path.join(viewsDir, `${baseTemplateName}-control-mobile.ejs`);
    
    // template 폴더에 없으면 views 폴더에서 찾기
    if (!fsSync.existsSync(baseTemplateFile)) {
      baseTemplateFile = path.join(viewsDir, `${baseTemplateName}-template.ejs`);
    }
    
    // 등록된 템플릿인 경우 (soccer, baseball 등) views 폴더에서 직접 찾기
    if (baseTemplateName === 'soccer' || baseTemplateName === 'baseball') {
      baseTemplateFile = path.join(viewsDir, `${baseTemplateName}-template.ejs`);
      baseControlFile = path.join(viewsDir, `${baseTemplateName}-control.ejs`);
      baseControlMobileFile = path.join(viewsDir, `${baseTemplateName}-control-mobile.ejs`);
    }
    
    const newTemplateFile = path.join(viewsDir, `${name}-template.ejs`);
    const newControlFile = path.join(viewsDir, `${name}-control.ejs`);
    const newControlMobileFile = path.join(viewsDir, `${name}-control-mobile.ejs`);

    // 기본 파일들이 존재하는지 확인
    if (!fsSync.existsSync(baseTemplateFile)) {
      return res.status(500).json({ error: `기본 템플릿 파일을 찾을 수 없습니다: ${baseTemplateName}` });
    }
    
    if (!fsSync.existsSync(baseControlFile)) {
      return res.status(500).json({ error: `기본 컨트롤 파일을 찾을 수 없습니다: ${baseTemplateName}-control.ejs` });
    }
    
    if (!fsSync.existsSync(baseControlMobileFile)) {
      return res.status(500).json({ error: `기본 모바일 컨트롤 파일을 찾을 수 없습니다: ${baseTemplateName}-control-mobile.ejs` });
    }

    // 기본 템플릿 내용을 읽어서 복사
    let baseTemplateContent = fsSync.readFileSync(baseTemplateFile, 'utf8');
    let baseControlContent = fsSync.readFileSync(baseControlFile, 'utf8');
    let baseControlMobileContent = fsSync.readFileSync(baseControlMobileFile, 'utf8');
    
    // 종목명 치환 (기본 템플릿의 종목명을 새로운 종목명으로 변경)
    const baseTemplateNameLower = baseTemplateName.toLowerCase();
    const baseTemplateNameUpper = baseTemplateName.toUpperCase();
    const newTemplateNameLower = name.toLowerCase();
    const newTemplateNameUpper = name.toUpperCase();
    
    // 종목 코드 생성 (템플릿 이름을 기반으로 고유한 코드 생성)
    const sportCode = name.toUpperCase();
    
    // 치환할 패턴들 정의 (단어 경계를 사용하여 정확한 매칭)
    const replacementPatterns = [
      // overlay-images API 경로
      {
        pattern: new RegExp(`/api/overlay-images/${baseTemplateNameLower}\\b`, 'g'),
        replacement: `/api/overlay-images/${sportCode}`
      },
      {
        pattern: new RegExp(`/api/overlay-images/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/api/overlay-images/${sportCode}`
      },
      // team-logo-map API 경로
      {
        pattern: new RegExp(`/api/team-logo-map/${baseTemplateNameLower}\\b`, 'g'),
        replacement: `/api/team-logo-map/${sportCode}`
      },
      {
        pattern: new RegExp(`/api/team-logo-map/${baseTemplateNameUpper}\\b`, 'g'),
        replacement: `/api/team-logo-map/${sportCode}`
      }
    ];

    // 템플릿 내용 치환
    replacementPatterns.forEach(({ pattern, replacement }) => {
      baseTemplateContent = baseTemplateContent.replace(pattern, replacement);
      baseControlContent = baseControlContent.replace(pattern, replacement);
      baseControlMobileContent = baseControlMobileContent.replace(pattern, replacement);
    });

    // 새 템플릿 파일들 생성
    console.log(`🔧 템플릿 파일 생성 중: ${newTemplateFile}`);
    fsSync.writeFileSync(newTemplateFile, baseTemplateContent);
    console.log(`✅ 템플릿 파일 생성 완료: ${newTemplateFile}`);
    
    console.log(`🔧 컨트롤 파일 생성 중: ${newControlFile}`);
    fsSync.writeFileSync(newControlFile, baseControlContent);
    console.log(`✅ 컨트롤 파일 생성 완료: ${newControlFile}`);
    
    console.log(`🔧 모바일 컨트롤 파일 생성 중: ${newControlMobileFile}`);
    fsSync.writeFileSync(newControlMobileFile, baseControlMobileContent);
    console.log(`✅ 모바일 컨트롤 파일 생성 완료: ${newControlMobileFile}`);

    // 데이터베이스에 템플릿 정보 저장
    const newTemplate = await Template.create({
      name,
      sport_type: sportCode,
      template_type: 'control', // 기본값: control
      content: baseTemplateContent, // 템플릿 내용
      file_name: `${name}-template.ejs`,
      created_by: req.session.userId || 'admin'
    });

    console.log(`새 템플릿 생성: ${name} (기본: ${baseTemplateName})`);
    res.json({ success: true, template: newTemplate });
  } catch (error) {
    console.error('템플릿 생성 실패:', error);
    res.status(500).json({ error: '템플릿 생성에 실패했습니다.' });
  }
}));

// PUT /api/templates/:id - 템플릿 수정
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const templateId = req.params.id;
    const { name, sport_type, template_type, description } = req.body;
    
    const template = await Template.findByPk(templateId);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    // 이름이 변경된 경우 중복 확인
    if (name && name !== template.name) {
      const existingTemplate = await Template.findOne({ 
        where: { name, id: { [require('sequelize').Op.ne]: templateId } }
      });
      if (existingTemplate) {
        return res.status(400).json({ error: '이미 존재하는 템플릿 이름입니다.' });
      }
    }

    await template.update({
      name: name || template.name,
      sport_type: sport_type || template.sport_type,
      template_type: template_type || template.template_type,
      description: description || template.description
    });

    console.log(`템플릿 수정: ${template.name}`);
    res.json({ success: true, template });
  } catch (error) {
    console.error('템플릿 수정 실패:', error);
    res.status(500).json({ error: '템플릿 수정에 실패했습니다.' });
  }
}));

// DELETE /api/templates/:id - 템플릿 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const templateId = req.params.id;
    
    const template = await Template.findByPk(templateId);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    // 템플릿 파일들 삭제
    const viewsDir = path.join(__dirname, '../views');
    const templateFile = path.join(viewsDir, `${template.name}-template.ejs`);
    const controlFile = path.join(viewsDir, `${template.name}-control.ejs`);
    const controlMobileFile = path.join(viewsDir, `${template.name}-control-mobile.ejs`);

    // 파일이 존재하면 삭제
    if (fsSync.existsSync(templateFile)) {
      console.log(`🔧 템플릿 파일 삭제: ${templateFile}`);
      fsSync.unlinkSync(templateFile);
      console.log(`✅ 템플릿 파일 삭제 완료`);
    }
    if (fsSync.existsSync(controlFile)) {
      console.log(`🔧 컨트롤 파일 삭제: ${controlFile}`);
      fsSync.unlinkSync(controlFile);
      console.log(`✅ 컨트롤 파일 삭제 완료`);
    }
    if (fsSync.existsSync(controlMobileFile)) {
      console.log(`🔧 모바일 컨트롤 파일 삭제: ${controlMobileFile}`);
      fsSync.unlinkSync(controlMobileFile);
      console.log(`✅ 모바일 컨트롤 파일 삭제 완료`);
    }

    // 데이터베이스에서 템플릿 삭제
    await template.destroy();

    console.log(`템플릿 삭제: ${template.name}`);
    res.json({ success: true });
  } catch (error) {
    console.error('템플릿 삭제 실패:', error);
    res.status(500).json({ error: '템플릿 삭제에 실패했습니다.' });
  }
}));

// GET /api/templates/:id/files - 템플릿 파일 목록 조회
router.get('/:id/files', asyncHandler(async (req, res) => {
  try {
    const templateId = req.params.id;
    
    const template = await Template.findByPk(templateId);
    if (!template) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    }

    const viewsDir = path.join(__dirname, '../views');
    const files = [];

    // 템플릿 파일들 확인 (3개 파일 모두 확인)
    const fileTypes = [
      { type: 'template', suffix: '-template.ejs' },
      { type: 'control', suffix: '-control.ejs' },
      { type: 'control-mobile', suffix: '-control-mobile.ejs' }
    ];

    for (const fileType of fileTypes) {
      const fileName = `${template.name}${fileType.suffix}`;
      const filePath = path.join(viewsDir, fileName);
      
      if (fsSync.existsSync(filePath)) {
        const stats = fsSync.statSync(filePath);
        files.push({
          type: fileType.type,
          name: fileName,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          exists: true
        });
        console.log(`파일 존재: ${fileName} - ${filePath}`);
      } else {
        files.push({
          type: fileType.type,
          name: fileName,
          path: filePath,
          size: 0,
          modified: null,
          exists: false
        });
        console.log(`파일 없음: ${fileName} - ${filePath}`);
      }
    }

    res.json({ files });
  } catch (error) {
    console.error('템플릿 파일 목록 조회 실패:', error);
    res.status(500).json({ error: '템플릿 파일 목록 조회에 실패했습니다.' });
  }
}));

module.exports = router;
