const { Client } = require('pg');
const fs = require('fs').promises;

// Stage DB 연결 정보
const stageConfig = {
  connectionString: "postgresql://postgres:REFuHuwHQbeBzRUuBuDopgLcdgIvocFo@trolley.proxy.rlwy.net:44142/railway"
};

// Main DB 연결 정보
const mainConfig = {
  connectionString: "postgresql://postgres:tmSpMARWaYwSxNpjOrDsKseXyfqrsNrY@mainline.proxy.rlwy.net:41632/railway"
};

async function migrateData() {
  const stageClient = new Client(stageConfig);
  const mainClient = new Client(mainConfig);
  
  try {
    console.log('🔌 Stage DB 연결 중...');
    await stageClient.connect();
    console.log('✅ Stage DB 연결 성공');
    
    console.log('🔌 Main DB 연결 중...');
    await mainClient.connect();
    console.log('✅ Main DB 연결 성공');
    
    // 1. 테이블 목록 조회
    console.log('📋 Stage DB 테이블 목록 조회 중...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await stageClient.query(tablesQuery);
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log('📊 발견된 테이블:', tables);
    
    // 2. 각 테이블의 데이터 백업
    const backupData = {};
    
    for (const tableName of tables) {
      console.log(`📦 ${tableName} 테이블 데이터 백업 중...`);
      
      // 테이블 구조 조회
      const structureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      const structureResult = await stageClient.query(structureQuery, [tableName]);
      const columns = structureResult.rows;
      
      // 테이블 데이터 조회
      const dataQuery = `SELECT * FROM "${tableName}";`;
      const dataResult = await stageClient.query(dataQuery);
      
      backupData[tableName] = {
        structure: columns,
        data: dataResult.rows
      };
      
      console.log(`✅ ${tableName}: ${dataResult.rows.length}개 레코드 백업 완료`);
    }
    
    // 3. 백업 데이터를 JSON 파일로 저장
    const backupFileName = `stage_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(backupFileName, JSON.stringify(backupData, null, 2));
    console.log(`💾 백업 파일 저장: ${backupFileName}`);
    
    // 4. Main DB에 테이블 생성 및 데이터 삽입
    console.log('🚀 Main DB에 데이터 마이그레이션 시작...');
    
    // 문제가 되는 테이블들을 제외하고 마이그레이션
    const skipTables = ['templates', 'user_sessions'];
    
    for (const [tableName, tableInfo] of Object.entries(backupData)) {
      if (skipTables.includes(tableName)) {
        console.log(`⚠️  ${tableName} 테이블은 건너뜁니다. (복잡한 구조)`);
        continue;
      }
      
      console.log(`🔨 ${tableName} 테이블 생성 중...`);
      
      // 테이블이 이미 존재하는지 확인
      const existsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      
      const existsResult = await mainClient.query(existsQuery, [tableName]);
      
      if (existsResult.rows[0].exists) {
        console.log(`⚠️  ${tableName} 테이블이 이미 존재합니다. 건너뜁니다.`);
        continue;
      }
      
      try {
        // 테이블 생성
        const createTableQuery = generateCreateTableQuery(tableName, tableInfo.structure);
        await mainClient.query(createTableQuery);
        console.log(`✅ ${tableName} 테이블 생성 완료`);
        
        // 데이터 삽입
        if (tableInfo.data.length > 0) {
          console.log(`📥 ${tableName}에 ${tableInfo.data.length}개 레코드 삽입 중...`);
          
          const insertQuery = generateInsertQuery(tableName, tableInfo.structure, tableInfo.data);
          await mainClient.query(insertQuery);
          console.log(`✅ ${tableName} 데이터 삽입 완료`);
        }
      } catch (error) {
        console.error(`❌ ${tableName} 테이블 처리 중 오류:`, error.message);
        console.log(`⚠️  ${tableName} 테이블을 건너뜁니다.`);
      }
    }
    
    console.log('🎉 마이그레이션 완료!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
  } finally {
    await stageClient.end();
    await mainClient.end();
    console.log('🔌 DB 연결 종료');
  }
}

function generateCreateTableQuery(tableName, columns) {
  const columnDefs = columns.map(col => {
    let def = `"${col.column_name}" ${col.data_type}`;
    
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    
    if (col.column_default) {
      // 시퀀스 참조를 SERIAL로 변환
      if (col.column_default.includes('nextval')) {
        def = `"${col.column_name}" SERIAL PRIMARY KEY`;
      } else {
        // 예약어나 특수 문자가 포함된 경우 따옴표로 감싸기
        let defaultValue = col.column_default;
        if (defaultValue.includes('USER') || defaultValue.includes('CURRENT_USER')) {
          defaultValue = defaultValue.replace(/USER/g, '"USER"');
        }
        def += ` DEFAULT ${defaultValue}`;
      }
    }
    
    return def;
  }).join(',\n  ');
  
  return `CREATE TABLE "${tableName}" (\n  ${columnDefs}\n);`;
}

function generateInsertQuery(tableName, columns, data) {
  if (data.length === 0) return '';
  
  const columnNames = columns.map(col => `"${col.column_name}"`).join(', ');
  const placeholders = data.map((_, rowIndex) => {
    const rowPlaceholders = columns.map((_, colIndex) => 
      `$${rowIndex * columns.length + colIndex + 1}`
    ).join(', ');
    return `(${rowPlaceholders})`;
  }).join(',\n  ');
  
  const values = data.flatMap(row => 
    columns.map(col => {
      const value = row[col.column_name];
      // JSON 타입인 경우 문자열로 변환
      if (col.data_type === 'json' || col.data_type === 'jsonb') {
        return typeof value === 'object' ? JSON.stringify(value) : value;
      }
      return value;
    })
  );
  
  const query = `INSERT INTO "${tableName}" (${columnNames}) VALUES\n  ${placeholders};`;
  
  return { text: query, values };
}

// 스크립트 실행
if (require.main === module) {
  migrateData().catch(console.error);
}

module.exports = { migrateData };
