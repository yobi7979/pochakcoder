const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const { 
  sequelize, 
  Match, 
  Template, 
  Sport, 
  SportOverlayImage, 
  SportActiveOverlayImage, 
  Settings, 
  MatchList, 
  User 
} = require('./models');

class BackupRestoreManager {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups');
    this.publicDir = path.join(__dirname, 'public');
  }

  // 백업 디렉토리 생성
  async ensureBackupDir() {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  // 전체 시스템 백업
  async createBackup(customName) {
    try {
      await this.ensureBackupDir();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let backupFileName;
      
      if (customName && customName.trim()) {
        // 사용자 지정 이름이 있는 경우
        const sanitizedName = customName.trim().replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
        backupFileName = `sportscoder-backup-${timestamp}-${sanitizedName}.zip`;
      } else {
        // 기본 파일명
        backupFileName = `sportscoder-backup-${timestamp}.zip`;
      }
      
      const backupPath = path.join(this.backupDir, backupFileName);
      
      // 백업 데이터 수집
      const backupData = await this.collectBackupData();
      
      // ZIP 파일 생성
      await this.createZipFile(backupPath, backupData);
      
      return {
        success: true,
        fileName: backupFileName,
        filePath: backupPath,
        size: (await fs.stat(backupPath)).size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('백업 생성 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 백업 데이터 수집
  async collectBackupData() {
    const backupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        description: 'SportsCoder 시스템 백업'
      },
      database: {},
      files: []
    };

    // 1. 사용자 생성 템플릿만 백업 (기본 템플릿 제외)
    backupData.database.templates = await Template.findAll({
      where: { is_default: false }
    });

    // 2. 사용자 생성 종목만 백업 (기본 종목 제외)
    backupData.database.sports = await Sport.findAll({
      where: { is_default: false }
    });

    // 3. 모든 경기 정보 백업
    backupData.database.matches = await Match.findAll();

    // 4. 모든 경기 목록 백업
    backupData.database.matchLists = await MatchList.findAll();

    // 5. 종목별 오버레이 이미지 정보 백업
    backupData.database.sportOverlayImages = await SportOverlayImage.findAll();

    // 6. 활성 오버레이 이미지 정보 백업
    backupData.database.sportActiveOverlayImages = await SportActiveOverlayImage.findAll();

    // 7. 시스템 설정 백업
    backupData.database.settings = await Settings.findAll();

    // 8. 파일 시스템 백업
    await this.collectFiles(backupData);

    return backupData;
  }

  // 파일 시스템 수집
  async collectFiles(backupData) {
    const filePaths = [];

    // 사용자 생성 템플릿 파일들 (컨트롤, 모바일 컨트롤, 오버레이 페이지)
    const templates = backupData.database.templates || [];
    for (const template of templates) {
      const templateName = template.name;
      
      // 템플릿 파일들 (오버레이 페이지)
      const templateFile = path.join(__dirname, 'views', `${templateName}-template.ejs`);
      if (await this.fileExists(templateFile)) {
        filePaths.push({
          source: templateFile,
          relative: `views/${templateName}-template.ejs`,
          type: 'template-file'
        });
      }

      // 컨트롤 파일들
      const controlFile = path.join(__dirname, 'views', `${templateName}-control.ejs`);
      if (await this.fileExists(controlFile)) {
        filePaths.push({
          source: controlFile,
          relative: `views/${templateName}-control.ejs`,
          type: 'control-file'
        });
      }

      // 모바일 컨트롤 파일들
      const mobileControlFile = path.join(__dirname, 'views', `${templateName}-control-mobile.ejs`);
      if (await this.fileExists(mobileControlFile)) {
        filePaths.push({
          source: mobileControlFile,
          relative: `views/${templateName}-control-mobile.ejs`,
          type: 'mobile-control-file'
        });
      }
    }

    // 오버레이 이미지 파일들
    const overlayImagesDir = path.join(this.publicDir, 'overlay-images');
    if (await this.directoryExists(overlayImagesDir)) {
      const overlayFiles = await this.getAllFiles(overlayImagesDir);
      filePaths.push(...overlayFiles.map(file => ({
        source: file,
        relative: path.relative(this.publicDir, file),
        type: 'overlay-image'
      })));
    }

    // 팀 로고 파일들
    const teamLogoDir = path.join(this.publicDir, 'TEAMLOGO');
    if (await this.directoryExists(teamLogoDir)) {
      const logoFiles = await this.getAllFiles(teamLogoDir);
      filePaths.push(...logoFiles.map(file => ({
        source: file,
        relative: path.relative(this.publicDir, file),
        type: 'team-logo'
      })));
    }

    // 경기 JSON 파일들
    const matchesDir = path.join(this.publicDir, 'matches');
    if (await this.directoryExists(matchesDir)) {
      const matchFiles = await this.getAllFiles(matchesDir);
      filePaths.push(...matchFiles.map(file => ({
        source: file,
        relative: path.relative(this.publicDir, file),
        type: 'match-data'
      })));
    }

    backupData.files = filePaths;
  }

  // 디렉토리 존재 확인
  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  // 디렉토리 내 모든 파일 수집
  async getAllFiles(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`디렉토리 읽기 오류: ${dirPath}`, error);
    }
    
    return files;
  }

  // ZIP 파일 생성
  async createZipFile(zipPath, backupData) {
    return new Promise(async (resolve, reject) => {
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`백업 파일 생성 완료: ${archive.pointer()} bytes`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // 메타데이터와 데이터베이스 정보를 JSON으로 추가
      archive.append(JSON.stringify(backupData.metadata, null, 2), { name: 'metadata.json' });
      archive.append(JSON.stringify(backupData.database, null, 2), { name: 'database.json' });

      // 파일들 추가
      for (const fileInfo of backupData.files) {
        try {
          await fs.access(fileInfo.source);
          archive.file(fileInfo.source, { name: `files/${fileInfo.relative}` });
        } catch {
          // 파일이 존재하지 않으면 건너뛰기
          console.warn(`파일을 찾을 수 없습니다: ${fileInfo.source}`);
        }
      }

      archive.finalize();
    });
  }

  // 파일 존재 확인
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // 백업 파일 복원
  async restoreBackup(backupFilePath) {
    try {
      // 백업 파일 존재 확인
      if (!await this.fileExists(backupFilePath)) {
        throw new Error('백업 파일을 찾을 수 없습니다.');
      }

      // 임시 디렉토리에 압축 해제
      const tempDir = path.join(__dirname, 'temp-restore');
      await fs.mkdir(tempDir, { recursive: true });

      // ZIP 파일 압축 해제
      await this.extractZipFile(backupFilePath, tempDir);

      // 메타데이터 확인
      const metadataPath = path.join(tempDir, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

      // 데이터베이스 복원
      await this.restoreDatabase(path.join(tempDir, 'database.json'));

      // 파일 시스템 복원
      await this.restoreFiles(tempDir);

      // 임시 디렉토리 정리
      await this.cleanupTempDir(tempDir);

      return {
        success: true,
        message: '백업 복원이 완료되었습니다.',
        metadata: metadata
      };
    } catch (error) {
      console.error('백업 복원 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 파일에서 백업 복원
  async restoreFromFile(filePath) {
    try {
      console.log(`백업 파일 복원 시작: ${filePath}`);
      
      // 복원 전 자동 백업 생성 (안전장치)
      console.log('복원 전 자동 백업 생성 중...');
      const autoBackupResult = await this.createBackup('auto-backup-before-restore');
      if (autoBackupResult.success) {
        console.log(`자동 백업 생성 완료: ${autoBackupResult.fileName}`);
      } else {
        console.warn('자동 백업 생성 실패:', autoBackupResult.error);
      }
      
      // 임시 디렉토리 생성
      const tempDir = path.join(__dirname, 'temp', `restore_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      // ZIP 파일 압축 해제
      await this.extractZipFile(filePath, tempDir);

      // 메타데이터 확인
      const metadataPath = path.join(tempDir, 'metadata.json');
      const databasePath = path.join(tempDir, 'database.json');
      
      if (!await this.fileExists(metadataPath) || !await this.fileExists(databasePath)) {
        throw new Error('백업 파일이 손상되었습니다. 필수 파일이 없습니다.');
      }

      // 백업 복원 실행
      const result = await this.restoreFromDirectory(tempDir);
      
      // 임시 디렉토리 정리
      await this.cleanupTempDir(tempDir);

      return result;
    } catch (error) {
      console.error('파일에서 백업 복원 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 디렉토리에서 백업 복원
  async restoreFromDirectory(tempDir) {
    try {
      // 메타데이터 확인
      const metadataPath = path.join(tempDir, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

      // 데이터베이스 복원
      await this.restoreDatabase(path.join(tempDir, 'database.json'));

      // 파일 시스템 복원
      await this.restoreFiles(tempDir);

      return {
        success: true,
        message: '백업 복원이 완료되었습니다.',
        metadata: metadata
      };
    } catch (error) {
      console.error('백업 복원 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ZIP 파일 압축 해제
  async extractZipFile(zipPath, extractPath) {
    return new Promise((resolve, reject) => {
      require('fs').createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .on('close', resolve)
        .on('error', reject);
    });
  }

  // 데이터베이스 복원
  async restoreDatabase(databaseJsonPath) {
    const databaseData = JSON.parse(await fs.readFile(databaseJsonPath, 'utf8'));

    // 트랜잭션으로 복원
    const transaction = await sequelize.transaction();

    try {
      // 1. 기존 사용자 데이터 삭제 (기본 데이터 제외)
      await Match.destroy({ where: {}, transaction });
      await MatchList.destroy({ where: {}, transaction });
      await Template.destroy({ where: { is_default: false }, transaction });
      await Sport.destroy({ where: { is_default: false }, transaction });
      await SportOverlayImage.destroy({ where: {}, transaction });
      await SportActiveOverlayImage.destroy({ where: {}, transaction });
      await Settings.destroy({ where: {}, transaction });

      // 2. 백업 데이터 복원
      if (databaseData.templates && databaseData.templates.length > 0) {
        // created_at, updated_at 필드 추가
        const templatesWithTimestamps = databaseData.templates.map(template => ({
          ...template,
          created_at: template.created_at || new Date(),
          updated_at: template.updated_at || new Date()
        }));
        await Template.bulkCreate(templatesWithTimestamps, { transaction });
      }

      if (databaseData.sports && databaseData.sports.length > 0) {
        // created_at, updated_at 필드 추가
        const sportsWithTimestamps = databaseData.sports.map(sport => ({
          ...sport,
          created_at: sport.created_at || new Date(),
          updated_at: sport.updated_at || new Date()
        }));
        await Sport.bulkCreate(sportsWithTimestamps, { transaction });
      }

      if (databaseData.matches && databaseData.matches.length > 0) {
        // created_at, updated_at 필드 추가
        const matchesWithTimestamps = databaseData.matches.map(match => ({
          ...match,
          created_at: match.created_at || new Date(),
          updated_at: match.updated_at || new Date()
        }));
        await Match.bulkCreate(matchesWithTimestamps, { transaction });
      }

      if (databaseData.matchLists && databaseData.matchLists.length > 0) {
        // created_at, updated_at 필드 추가
        const matchListsWithTimestamps = databaseData.matchLists.map(matchList => ({
          ...matchList,
          created_at: matchList.created_at || new Date(),
          updated_at: matchList.updated_at || new Date()
        }));
        await MatchList.bulkCreate(matchListsWithTimestamps, { transaction });
      }

      if (databaseData.sportOverlayImages && databaseData.sportOverlayImages.length > 0) {
        // created_at, updated_at 필드 추가
        const imagesWithTimestamps = databaseData.sportOverlayImages.map(image => ({
          ...image,
          created_at: image.created_at || new Date(),
          updated_at: image.updated_at || new Date()
        }));
        await SportOverlayImage.bulkCreate(imagesWithTimestamps, { transaction });
      }

      if (databaseData.sportActiveOverlayImages && databaseData.sportActiveOverlayImages.length > 0) {
        // created_at, updated_at 필드 추가
        const activeImagesWithTimestamps = databaseData.sportActiveOverlayImages.map(image => ({
          ...image,
          created_at: image.created_at || new Date(),
          updated_at: image.updated_at || new Date()
        }));
        await SportActiveOverlayImage.bulkCreate(activeImagesWithTimestamps, { transaction });
      }

      if (databaseData.settings && databaseData.settings.length > 0) {
        // created_at, updated_at 필드 추가
        const settingsWithTimestamps = databaseData.settings.map(setting => ({
          ...setting,
          created_at: setting.created_at || new Date(),
          updated_at: setting.updated_at || new Date()
        }));
        await Settings.bulkCreate(settingsWithTimestamps, { transaction });
      }

      await transaction.commit();
      console.log('데이터베이스 복원 완료');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 파일 시스템 복원
  async restoreFiles(tempDir) {
    const filesDir = path.join(tempDir, 'files');
    
    if (!await this.directoryExists(filesDir)) {
      return;
    }

    // 기존 파일들 삭제 (백업된 파일들만)
    await this.cleanupExistingFiles();

    // 백업된 파일들 복원
    const allFiles = await this.getAllFiles(filesDir);
    
    for (const filePath of allFiles) {
      const relativePath = path.relative(filesDir, filePath);
      
      // 템플릿 파일들은 views 디렉토리로 복원
      if (relativePath.startsWith('views/')) {
        const targetPath = path.join(__dirname, relativePath);
        
        // 대상 디렉토리 생성
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // 파일 복사
        await fs.copyFile(filePath, targetPath);
      } else {
        // 기타 파일들은 public 디렉토리로 복원
        const targetPath = path.join(this.publicDir, relativePath);
        
        // 대상 디렉토리 생성
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // 파일 복사
        await fs.copyFile(filePath, targetPath);
      }
    }

    console.log('파일 시스템 복원 완료');
  }

  // 기존 파일들 정리
  async cleanupExistingFiles() {
    // 1. 기존 사용자 생성 템플릿 파일들 삭제
    const existingTemplates = await Template.findAll({
      where: { is_default: false }
    });
    
    for (const template of existingTemplates) {
      const templateName = template.name;
      
      // 템플릿 파일들 삭제
      const templateFiles = [
        path.join(__dirname, 'views', `${templateName}-template.ejs`),
        path.join(__dirname, 'views', `${templateName}-control.ejs`),
        path.join(__dirname, 'views', `${templateName}-control-mobile.ejs`)
      ];
      
      for (const filePath of templateFiles) {
        try {
          if (await this.fileExists(filePath)) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          console.warn(`템플릿 파일 삭제 실패: ${filePath}`, error.message);
        }
      }
    }

    // 2. 기존 디렉토리들 정리
    const dirsToClean = [
      path.join(this.publicDir, 'overlay-images'),
      path.join(this.publicDir, 'TEAMLOGO'),
      path.join(this.publicDir, 'matches')
    ];

    for (const dir of dirsToClean) {
      if (await this.directoryExists(dir)) {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  // 임시 디렉토리 정리
  async cleanupTempDir(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('임시 디렉토리 정리 오류:', error);
    }
  }

  // 백업 목록 조회
  async getBackupList() {
    try {
      await this.ensureBackupDir();
      
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.endsWith('.zip') && file.startsWith('sportscoder-backup-'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = require('fs').statSync(filePath);
          return {
            fileName: file,
            filePath: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.created - a.created);

      return backupFiles;
    } catch (error) {
      console.error('백업 목록 조회 오류:', error);
      return [];
    }
  }

  // 백업 파일 삭제
  async deleteBackup(fileName) {
    try {
      const filePath = path.join(this.backupDir, fileName);
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('백업 파일 삭제 오류:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BackupRestoreManager;
