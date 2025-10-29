const { Client } = require('pg');
const fs = require('fs').promises;

// Main DB 연결 정보
const mainConfig = {
  connectionString: "postgresql://postgres:tmSpMARWaYwSxNpjOrDsKseXyfqrsNrY@mainline.proxy.rlwy.net:41632/railway"
};

// Stage DB 연결 정보
const stageConfig = {
  connectionString: "postgresql://postgres:REFuHuwHQbeBzRUuBuDopgLcdgIvocFo@trolley.proxy.rlwy.net:44142/railway"
};

async function createMissingTables() {
  const mainClient = new Client(mainConfig);
  const stageClient = new Client(stageConfig);
  
  try {
    console.log('🔌 DB 연결 중...');
    await mainClient.connect();
    await stageClient.connect();
    console.log('✅ DB 연결 성공');
    
    // 누락된 테이블들
    const missingTables = ['templates', 'user_sessions', 'users'];
    
    for (const tableName of missingTables) {
      console.log(`\n🔨 ${tableName} 테이블 생성 중...`);
      
      // Stage DB에서 테이블 구조 조회
      const structureQuery = `
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      const structureResult = await stageClient.query(structureQuery, [tableName]);
      const columns = structureResult.rows;
      
      if (columns.length === 0) {
        console.log(`⚠️  ${tableName} 테이블을 Stage DB에서 찾을 수 없습니다.`);
        continue;
      }
      
      // 테이블 생성 쿼리 생성
      const createTableQuery = generateCreateTableQuery(tableName, columns);
      console.log(`📝 생성 쿼리: ${createTableQuery}`);
      
      try {
        await mainClient.query(createTableQuery);
        console.log(`✅ ${tableName} 테이블 생성 완료`);
        
        // 데이터 조회 및 삽입
        const dataQuery = `SELECT * FROM "${tableName}";`;
        const dataResult = await stageClient.query(dataQuery);
        
        if (dataResult.rows.length > 0) {
          console.log(`📥 ${tableName}에 ${dataResult.rows.length}개 레코드 삽입 중...`);
          
          // 데이터를 한 번에 하나씩 삽입 (복잡한 구조 때문에)
          for (const row of dataResult.rows) {
            try {
              const insertQuery = generateInsertQuery(tableName, columns, [row]);
              await mainClient.query(insertQuery);
            } catch (error) {
              console.log(`⚠️  레코드 삽입 오류 (건너뜀): ${error.message}`);
            }
          }
          console.log(`✅ ${tableName} 데이터 삽입 완료`);
        } else {
          console.log(`ℹ️  ${tableName}에 삽입할 데이터가 없습니다.`);
        }
        
      } catch (error) {
        console.error(`❌ ${tableName} 테이블 생성 오류:`, error.message);
      }
    }
    
    console.log('\n🎉 누락된 테이블 생성 완료!');
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await mainClient.end();
    await stageClient.end();
    console.log('🔌 DB 연결 종료');
  }
}

function generateCreateTableQuery(tableName, columns) {
  const columnDefs = columns.map(col => {
    let def = `"${col.column_name}" ${col.data_type}`;
    
    // 길이 제한이 있는 경우
    if (col.character_maximum_length) {
      def = `"${col.column_name}" ${col.data_type}(${col.character_maximum_length})`;
    }
    
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    
    if (col.column_default) {
      // 시퀀스 참조를 SERIAL로 변환
      if (col.column_default.includes('nextval')) {
        def = `"${col.column_name}" SERIAL PRIMARY KEY`;
      } else {
        // 예약어 처리
        let defaultValue = col.column_default;
        if (defaultValue.includes('CURRENT_USER')) {
          defaultValue = defaultValue.replace(/CURRENT_USER/g, 'CURRENT_USER');
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
  createMissingTables().catch(console.error);
}

module.exports = { createMissingTables };
