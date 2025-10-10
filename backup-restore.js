const fs = require('fs').promises;
const path = require('path');
// const archiver = require('archiver'); // 임시 비활성화
// const unzipper = require('unzipper'); // 임시 비활성화
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
    // Railway 환경에서는 메모리 기반 백업 사용
    if (process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production') {
      // Railway 환경에서는 메모리 기반 백업
      this.backupDir = null; // 파일 시스템 사용 안함
      this.useMemoryBackup = true;
    } else {
      this.backupDir = path.join(__dirname, 'backups');
      this.useMemoryBackup = false;
    }
    this.publicDir = path.join(__dirname, 'public');
  }

  // 백업 디렉토리 생성
  async ensureBackupDir() {
    if (this.useMemoryBackup) {
      console.log('메모리 기반 백업 사용 - 디렉토리 생성 건너뛰기');
      return;
    }
    
    try {
      await fs.access(this.backupDir);
    } catch {
      try {
        await fs.mkdir(this.backupDir, { recursive: true });
        console.log(`백업 디렉토리 생성 완료: ${this.backupDir}`);
      } catch (error) {
        console.error('백업 디렉토리 생성 실패:', error);
        throw new Error(`백업 디렉토리 생성 실패: ${error.message}`);
      }
    }
  }

  // 전체 시스템 백업
  async createBackup(customName) {
    try {
      console.log('백업 생성 시작...');
      console.log(`메모리 기반 백업: ${this.useMemoryBackup}`);
      console.log(`Railway 환경: ${process.env.RAILWAY_ENVIRONMENT}`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
      
      if (!this.useMemoryBackup) {
        await this.ensureBackupDir();
      }
      
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
      
      // Railway 환경에서는 데이터베이스만 백업
      console.log('백업 데이터 수집 시작...');
      const backupData = await this.collectBackupData();
      console.log('백업 데이터 수집 완료');
      
      if (this.useMemoryBackup) {
        // Railway 환경에서는 JSON 데이터만 내보내기
        console.log('Railway 환경: JSON 데이터 백업 생성...');
        const jsonData = JSON.stringify(backupData, null, 2);
        const jsonBuffer = Buffer.from(jsonData, 'utf8');
        console.log(`JSON 백업 생성 완료: ${jsonBuffer.length} bytes`);
        
        // Railway 환경에서 서버 저장 시도
        let serverSaveResult = null;
        try {
          console.log('Railway 환경에서 서버 저장 시도...');
          const tempDir = path.join(require('os').tmpdir(), 'sportscoder-backups');
          await fs.mkdir(tempDir, { recursive: true });
          
          const serverFilePath = path.join(tempDir, backupFileName.replace('.zip', '.json'));
          await fs.writeFile(serverFilePath, jsonData, 'utf8');
          
          const serverFileStats = await fs.stat(serverFilePath);
          serverSaveResult = {
            success: true,
            filePath: serverFilePath,
            size: serverFileStats.size
          };
          console.log(`Railway 서버 저장 성공: ${serverFilePath} (${serverFileStats.size} bytes)`);
        } catch (serverError) {
          console.warn('Railway 서버 저장 실패:', serverError.message);
          serverSaveResult = {
            success: false,
            error: serverError.message
          };
        }
        
        return {
          success: true,
          fileName: backupFileName.replace('.zip', '.json'), // JSON 파일로 변경
          filePath: serverSaveResult?.success ? serverSaveResult.filePath : null,
          size: jsonBuffer.length,
          timestamp: new Date().toISOString(),
          data: jsonData, // JSON 문자열 데이터
          downloadUrl: `data:application/json;charset=utf-8,${encodeURIComponent(jsonData)}`, // JSON 다운로드 URL
          serverSave: serverSaveResult // 서버 저장 결과
        };
      } else {
        // 로컬 환경에서는 파일 기반 백업
        const backupPath = path.join(this.backupDir, backupFileName);
        console.log(`백업 파일 경로: ${backupPath}`);
        
        // ZIP 파일 생성
        console.log('ZIP 파일 생성 시작...');
        await this.createZipFile(backupPath, backupData);
        console.log('ZIP 파일 생성 완료');
        
        const fileStats = await fs.stat(backupPath);
        console.log(`백업 파일 크기: ${fileStats.size} bytes`);
        
        return {
          success: true,
          fileName: backupFileName,
          filePath: backupPath,
          size: fileStats.size,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('백업 생성 오류:', error);
      console.error('에러 상세:', error.message);
      console.error('스택 트레이스:', error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  // 백업 데이터 수집
  async collectBackupData() {
    try {
      console.log('백업 데이터 수집 시작...');
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
      console.log('템플릿 데이터 수집...');
      try {
        backupData.database.templates = await Template.findAll({
          where: { is_default: false }
        });
        console.log(`템플릿 ${backupData.database.templates.length}개 수집 완료`);
      } catch (error) {
        console.warn('템플릿 데이터 수집 실패:', error.message);
        try {
          // 기본 템플릿 제외 없이 모든 템플릿 수집
          backupData.database.templates = await Template.findAll();
          console.log(`템플릿 ${backupData.database.templates.length}개 수집 완료 (전체)`);
        } catch (secondError) {
          console.warn('템플릿 데이터 수집 완전 실패:', secondError.message);
          backupData.database.templates = [];
          console.log('템플릿 데이터 수집 실패 - 빈 배열로 설정');
        }
      }

      // 2. 사용자 생성 종목만 백업 (기본 종목 제외)
      console.log('종목 데이터 수집...');
      try {
        // 먼저 기본 종목이 아닌 것들만 조회
        backupData.database.sports = await Sport.findAll({
          where: { is_default: false }
        });
        console.log(`종목 ${backupData.database.sports.length}개 수집 완료`);
      } catch (error) {
        console.warn('종목 데이터 수집 실패 (created_by 컬럼 없음):', error.message);
        try {
          // created_by 컬럼이 없는 경우 모든 종목 수집
          backupData.database.sports = await Sport.findAll();
          console.log(`종목 ${backupData.database.sports.length}개 수집 완료 (전체)`);
        } catch (secondError) {
          console.warn('종목 데이터 수집 완전 실패:', secondError.message);
          backupData.database.sports = [];
          console.log('종목 데이터 수집 실패 - 빈 배열로 설정');
        }
      }

      // 3. 모든 경기 정보 백업
      console.log('경기 데이터 수집...');
      backupData.database.matches = await Match.findAll();
      console.log(`경기 ${backupData.database.matches.length}개 수집 완료`);

      // 4. 모든 경기 목록 백업
      console.log('경기 목록 데이터 수집...');
      try {
        backupData.database.matchLists = await MatchList.findAll({
          attributes: { exclude: ['created_by'] } // created_by 컬럼 제외
        });
        console.log(`경기 목록 ${backupData.database.matchLists.length}개 수집 완료`);
      } catch (error) {
        console.warn('경기 목록 데이터 수집 실패 (created_by 컬럼 없음):', error.message);
        backupData.database.matchLists = await MatchList.findAll();
        console.log(`경기 목록 ${backupData.database.matchLists.length}개 수집 완료 (created_by 제외)`);
      }

      // 5. 종목별 오버레이 이미지 정보 백업
      console.log('오버레이 이미지 데이터 수집...');
      try {
        backupData.database.sportOverlayImages = await SportOverlayImage.findAll({
          attributes: { exclude: ['created_by'] } // created_by 컬럼 제외
        });
        console.log(`오버레이 이미지 ${backupData.database.sportOverlayImages.length}개 수집 완료`);
      } catch (error) {
        console.warn('오버레이 이미지 데이터 수집 실패 (created_by 컬럼 없음):', error.message);
        backupData.database.sportOverlayImages = await SportOverlayImage.findAll();
        console.log(`오버레이 이미지 ${backupData.database.sportOverlayImages.length}개 수집 완료 (created_by 제외)`);
      }

      // 6. 활성 오버레이 이미지 정보 백업
      console.log('활성 오버레이 이미지 데이터 수집...');
      try {
        backupData.database.sportActiveOverlayImages = await SportActiveOverlayImage.findAll({
          attributes: { exclude: ['created_by'] } // created_by 컬럼 제외
        });
        console.log(`활성 오버레이 이미지 ${backupData.database.sportActiveOverlayImages.length}개 수집 완료`);
      } catch (error) {
        console.warn('활성 오버레이 이미지 데이터 수집 실패 (created_by 컬럼 없음):', error.message);
        backupData.database.sportActiveOverlayImages = await SportActiveOverlayImage.findAll();
        console.log(`활성 오버레이 이미지 ${backupData.database.sportActiveOverlayImages.length}개 수집 완료 (created_by 제외)`);
      }

      // 7. 시스템 설정 백업
      console.log('시스템 설정 데이터 수집...');
      try {
        backupData.database.settings = await Settings.findAll({
          attributes: { exclude: ['created_by'] } // created_by 컬럼 제외
        });
        console.log(`시스템 설정 ${backupData.database.settings.length}개 수집 완료`);
      } catch (error) {
        console.warn('시스템 설정 데이터 수집 실패 (created_by 컬럼 없음):', error.message);
        backupData.database.settings = await Settings.findAll();
        console.log(`시스템 설정 ${backupData.database.settings.length}개 수집 완료 (created_by 제외)`);
      }

      // 8. 파일 시스템 백업
      console.log('파일 시스템 데이터 수집...');
      await this.collectFiles(backupData);
      console.log(`파일 ${backupData.files.length}개 수집 완료`);

      console.log('백업 데이터 수집 완료');
      return backupData;
    } catch (error) {
      console.error('백업 데이터 수집 오류:', error);
      throw error;
    }
  }

  // 파일 시스템 수집
  async collectFiles(backupData) {
    const filePaths = [];

    // Railway 환경에서는 파일 시스템 접근이 제한적이므로 데이터베이스만 백업
    if (process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production') {
      console.log('Railway 환경: 파일 시스템 백업 건너뛰기');
      backupData.files = [];
      return;
    }

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
      try {
        const output = require('fs').createWriteStream(zipPath);
        // const archive = archiver('zip', { zlib: { level: 9 } }); // 임시 비활성화
        const archive = null; // 임시로 null 설정

        output.on('close', () => {
          console.log(`백업 파일 생성 완료: ${archive.pointer()} bytes`);
          resolve();
        });

        archive.on('error', (err) => {
          console.error('ZIP 파일 생성 오류:', err);
          reject(err);
        });

        archive.pipe(output);

        // 메타데이터와 데이터베이스 정보를 JSON으로 추가
        archive.append(JSON.stringify(backupData.metadata, null, 2), { name: 'metadata.json' });
        archive.append(JSON.stringify(backupData.database, null, 2), { name: 'database.json' });

        // Railway 환경에서는 파일 시스템 접근이 제한적이므로 파일 추가 건너뛰기
        if (process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production') {
          console.log('Railway 환경: 파일 시스템 백업 건너뛰기');
        } else {
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
        }

        archive.finalize();
      } catch (error) {
        console.error('ZIP 파일 생성 중 오류:', error);
        reject(error);
      }
    });
  }

  // 메모리 기반 ZIP 버퍼 생성 (Railway 환경용)
  async createZipBuffer(backupData) {
    return new Promise(async (resolve, reject) => {
      try {
        const chunks = [];
        // const archive = archiver('zip', { zlib: { level: 9 } }); // 임시 비활성화
        const archive = null; // 임시로 null 설정

        archive.on('data', (chunk) => {
          chunks.push(chunk);
        });

        archive.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`메모리 백업 생성 완료: ${buffer.length} bytes`);
          resolve(buffer);
        });

        archive.on('error', (err) => {
          console.error('메모리 ZIP 생성 오류:', err);
          reject(err);
        });

        // 메타데이터와 데이터베이스 정보를 JSON으로 추가
        archive.append(JSON.stringify(backupData.metadata, null, 2), { name: 'metadata.json' });
        archive.append(JSON.stringify(backupData.database, null, 2), { name: 'database.json' });

        // Railway 환경에서는 파일 시스템 접근이 제한적이므로 파일 추가 건너뛰기
        console.log('Railway 환경: 파일 시스템 백업 건너뛰기');

        archive.finalize();
      } catch (error) {
        console.error('메모리 ZIP 생성 중 오류:', error);
        reject(error);
      }
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
      if (this.useMemoryBackup) {
        // Railway 환경에서는 파일 업로드 방식으로만 복원 가능
        throw new Error('Railway 환경에서는 파일 업로드 방식으로만 백업 복원이 가능합니다.');
      }
      
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
      
      if (this.useMemoryBackup) {
        // Railway 환경에서는 자동 백업 생성 건너뛰기
        console.log('Railway 환경: 자동 백업 생성 건너뛰기');
      } else {
        // 복원 전 자동 백업 생성 (안전장치)
        console.log('복원 전 자동 백업 생성 중...');
        const autoBackupResult = await this.createBackup('auto-backup-before-restore');
        if (autoBackupResult.success) {
          console.log(`자동 백업 생성 완료: ${autoBackupResult.fileName}`);
        } else {
          console.warn('자동 백업 생성 실패:', autoBackupResult.error);
        }
      }
      
      // JSON 파일인지 ZIP 파일인지 확인
      if (filePath.endsWith('.json')) {
        // JSON 파일 직접 처리
        console.log('JSON 백업 파일 복원...');
        const jsonData = await fs.readFile(filePath, 'utf8');
        const backupData = JSON.parse(jsonData);
        
        // 데이터베이스 복원
        await this.restoreDatabaseFromData(backupData.database);
        
        return {
          success: true,
          message: 'JSON 백업 복원이 완료되었습니다.',
          metadata: backupData.metadata
        };
      } else {
        // ZIP 파일 처리 (로컬 환경)
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
      }
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
        // .pipe(unzipper.Extract({ path: extractPath })) // 임시 비활성화
        .pipe(require('fs').createWriteStream(extractPath)) // 임시 대체
        .on('close', resolve)
        .on('error', reject);
    });
  }

  // JSON 데이터에서 데이터베이스 복원 (Railway 환경용)
  async restoreDatabaseFromData(databaseData) {
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
        const templatesWithTimestamps = databaseData.templates.map(template => ({
          ...template,
          created_at: template.created_at || new Date(),
          updated_at: template.updated_at || new Date()
        }));
        await Template.bulkCreate(templatesWithTimestamps, { transaction });
      }

      if (databaseData.sports && databaseData.sports.length > 0) {
        const sportsWithTimestamps = databaseData.sports.map(sport => ({
          ...sport,
          created_at: sport.created_at || new Date(),
          updated_at: sport.updated_at || new Date()
        }));
        await Sport.bulkCreate(sportsWithTimestamps, { transaction });
      }

      if (databaseData.matches && databaseData.matches.length > 0) {
        const matchesWithTimestamps = databaseData.matches.map(match => ({
          ...match,
          created_at: match.created_at || new Date(),
          updated_at: match.updated_at || new Date()
        }));
        await Match.bulkCreate(matchesWithTimestamps, { transaction });
      }

      if (databaseData.matchLists && databaseData.matchLists.length > 0) {
        const matchListsWithTimestamps = databaseData.matchLists.map(matchList => ({
          ...matchList,
          created_at: matchList.created_at || new Date(),
          updated_at: matchList.updated_at || new Date()
        }));
        await MatchList.bulkCreate(matchListsWithTimestamps, { transaction });
      }

      if (databaseData.sportOverlayImages && databaseData.sportOverlayImages.length > 0) {
        const imagesWithTimestamps = databaseData.sportOverlayImages.map(image => ({
          ...image,
          created_at: image.created_at || new Date(),
          updated_at: image.updated_at || new Date()
        }));
        await SportOverlayImage.bulkCreate(imagesWithTimestamps, { transaction });
      }

      if (databaseData.sportActiveOverlayImages && databaseData.sportActiveOverlayImages.length > 0) {
        const activeImagesWithTimestamps = databaseData.sportActiveOverlayImages.map(image => ({
          ...image,
          created_at: image.created_at || new Date(),
          updated_at: image.updated_at || new Date()
        }));
        await SportActiveOverlayImage.bulkCreate(activeImagesWithTimestamps, { transaction });
      }

      if (databaseData.settings && databaseData.settings.length > 0) {
        const settingsWithTimestamps = databaseData.settings.map(setting => ({
          ...setting,
          created_at: setting.created_at || new Date(),
          updated_at: setting.updated_at || new Date()
        }));
        await Settings.bulkCreate(settingsWithTimestamps, { transaction });
      }

      await transaction.commit();
      console.log('JSON 데이터베이스 복원 완료');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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
      if (this.useMemoryBackup) {
        // Railway 환경에서는 임시 디렉토리에서 백업 파일 조회 시도
        console.log('Railway 환경: 임시 디렉토리에서 백업 목록 조회 시도...');
        try {
          const tempDir = path.join(require('os').tmpdir(), 'sportscoder-backups');
          await fs.access(tempDir);
          
          const files = await fs.readdir(tempDir);
          const backupFiles = files
            .filter(file => file.endsWith('.json') && file.startsWith('sportscoder-backup-'))
            .map(file => {
              const filePath = path.join(tempDir, file);
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
          
          console.log(`Railway 환경에서 ${backupFiles.length}개 백업 파일 발견`);
          return backupFiles;
        } catch (error) {
          console.warn('Railway 환경에서 백업 목록 조회 실패:', error.message);
          return [];
        }
      }
      
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

  // 백업 파일 경로 조회
  async getBackupPath(fileName) {
    try {
      if (this.useMemoryBackup) {
        // Railway 환경에서는 임시 디렉토리에서 파일 조회
        const tempDir = path.join(require('os').tmpdir(), 'sportscoder-backups');
        return path.join(tempDir, fileName);
      }
      
      return path.join(this.backupDir, fileName);
    } catch (error) {
      console.error('백업 파일 경로 조회 오류:', error);
      throw new Error(`백업 파일 경로 조회 실패: ${error.message}`);
    }
  }

  // 백업 파일 삭제
  async deleteBackup(fileName) {
    try {
      if (this.useMemoryBackup) {
        // Railway 환경에서는 메모리 기반 백업이므로 삭제 불가
        console.log('Railway 환경: 메모리 기반 백업 사용 - 삭제 불가');
        return { success: false, error: 'Railway 환경에서는 백업 파일 삭제가 불가능합니다.' };
      }
      
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
