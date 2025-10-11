const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

// GET /api/db-management/tables - 전체 테이블 목록 조회
router.get('/tables', async (req, res) => {
  console.log('라우터 매칭 성공: GET /tables');
  try {
    // PostgreSQL에서 테이블 목록 조회 (간단한 쿼리)
    let tables;
    try {
      tables = await sequelize.query(`
        SELECT 
          tablename as name,
          'table' as type
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `, {
        type: sequelize.QueryTypes.SELECT
      });
    } catch (queryError) {
      console.error('pg_tables 쿼리 실패, information_schema로 fallback:', queryError.message);
      // Fallback: information_schema 사용
      tables = await sequelize.query(`
        SELECT 
          table_name as name,
          'table' as type
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `, {
        type: sequelize.QueryTypes.SELECT
      });
    }

    console.log(`테이블 목록 조회 완료: ${tables.length}개 테이블`);
    
    // 각 테이블에 대한 추가 정보 수집 (안전한 방식)
    const tablesWithInfo = await Promise.all(tables.map(async (table) => {
      try {
        // 테이블 행 수 계산 (안전한 방식)
        let rowCount = 0;
        try {
          const rowCountResult = await sequelize.query(`
            SELECT COUNT(*) as count FROM "${table.name}"
          `, {
            type: sequelize.QueryTypes.SELECT
          });
          rowCount = parseInt(rowCountResult[0]?.count || 0);
        } catch (countError) {
          console.log(`테이블 ${table.name} 행 수 계산 실패, 0으로 설정:`, countError.message);
          rowCount = 0;
        }
        
        // 테이블 크기 계산 (안전한 방식)
        let size = 'Unknown';
        try {
          const sizeResult = await sequelize.query(`
            SELECT pg_size_pretty(pg_total_relation_size('${table.name}')) as size
          `, {
            type: sequelize.QueryTypes.SELECT
          });
          size = sizeResult[0]?.size || 'Unknown';
        } catch (sizeError) {
          console.log(`테이블 ${table.name} 크기 계산 실패:`, sizeError.message);
          size = 'Unknown';
        }
        
        return {
          ...table,
          rowCount: rowCount,
          size: size,
          createdAt: new Date().toISOString().split('T')[0]
        };
      } catch (error) {
        console.error(`테이블 ${table.name} 정보 수집 실패:`, error.message);
        return {
          ...table,
          rowCount: 0,
          size: 'Unknown',
          createdAt: new Date().toISOString().split('T')[0]
        };
      }
    }));

    res.json({
      success: true,
      tables: tablesWithInfo,
      message: `총 ${tablesWithInfo.length}개 테이블을 찾았습니다.`
    });

  } catch (error) {
    console.error('테이블 목록 조회 실패:', error);
    console.error('에러 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      message: '테이블 목록을 불러오는데 실패했습니다.',
      error: error.message,
      details: {
        name: error.name,
        message: error.message
      }
    });
  }
});

// GET /api/db-management/tables/:tableName/data - 특정 테이블 데이터 조회
router.get('/tables/:tableName/data', async (req, res) => {
  const { tableName } = req.params;
  console.log(`테이블 데이터 조회 요청: ${tableName}`);
  
  try {
    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ?
      )
    `, {
      replacements: [tableName],
      type: sequelize.QueryTypes.SELECT
    });

    if (!tableExists[0].exists) {
      return res.status(404).json({
        success: false,
        message: `테이블 '${tableName}'을 찾을 수 없습니다.`
      });
    }

    // 테이블 컬럼 정보 조회
    const columns = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ?
      ORDER BY ordinal_position
    `, {
      replacements: [tableName],
      type: sequelize.QueryTypes.SELECT
    });

    const columnNames = columns.map(col => col.column_name);

    // 테이블 데이터 조회 (최대 1000행)
    const rows = await sequelize.query(`
      SELECT * FROM "${tableName}" LIMIT 1000
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`테이블 ${tableName} 데이터 조회 완료: ${rows.length}개 행`);

    res.json({
      success: true,
      tableName: tableName,
      columns: columnNames,
      rows: rows,
      totalRows: rows.length,
      message: `${tableName} 테이블의 데이터를 성공적으로 조회했습니다.`
    });

  } catch (error) {
    console.error(`테이블 ${tableName} 데이터 조회 실패:`, error);
    res.status(500).json({
      success: false,
      message: `테이블 '${tableName}'의 데이터를 불러오는데 실패했습니다.`,
      error: error.message
    });
  }
});

// GET /api/db-management/tables/:tableName/structure - 테이블 구조 조회
router.get('/tables/:tableName/structure', async (req, res) => {
  const { tableName } = req.params;
  console.log(`테이블 구조 조회 요청: ${tableName}`);
  
  try {
    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ?
      )
    `, {
      replacements: [tableName],
      type: sequelize.QueryTypes.SELECT
    });

    if (!tableExists[0].exists) {
      return res.status(404).json({
        success: false,
        message: `테이블 '${tableName}'을 찾을 수 없습니다.`
      });
    }

    // 테이블 구조 정보 조회
    const structure = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ?
      ORDER BY ordinal_position
    `, {
      replacements: [tableName],
      type: sequelize.QueryTypes.SELECT
    });

    // 인덱스 정보 조회
    const indexes = await sequelize.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ?
    `, {
      replacements: [tableName],
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`테이블 ${tableName} 구조 조회 완료: ${structure.length}개 컬럼`);

    res.json({
      success: true,
      tableName: tableName,
      structure: {
        columns: structure,
        indexes: indexes
      },
      message: `${tableName} 테이블의 구조를 성공적으로 조회했습니다.`
    });

  } catch (error) {
    console.error(`테이블 ${tableName} 구조 조회 실패:`, error);
    res.status(500).json({
      success: false,
      message: `테이블 '${tableName}'의 구조를 불러오는데 실패했습니다.`,
      error: error.message
    });
  }
});

// POST /api/db-management/tables - 새 테이블 생성
router.post('/tables', async (req, res) => {
  const { name, description, columns } = req.body;
  console.log(`새 테이블 생성 요청: ${name}`);
  console.log('테이블 정보:', { name, description, columns });
  
  try {
    // 테이블명 중복 확인
    const tableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ?
      )
    `, {
      replacements: [name],
      type: sequelize.QueryTypes.SELECT
    });

    if (tableExists[0].exists) {
      return res.status(400).json({
        success: false,
        message: `테이블 '${name}'이 이미 존재합니다.`
      });
    }

    // 컬럼 정의 생성
    let columnDefinitions = '';
    columns.forEach((col, index) => {
      if (index > 0) columnDefinitions += ', ';
      
      let colDef = `"${col.name}" ${col.type}`;
      
      if (col.primaryKey) {
        colDef += ' PRIMARY KEY';
      }
      
      if (col.autoIncrement) {
        colDef += ' SERIAL';
      }
      
      if (!col.allowNull && !col.primaryKey) {
        colDef += ' NOT NULL';
      }
      
      if (col.defaultValue) {
        colDef += ` DEFAULT '${col.defaultValue}'`;
      }
      
      columnDefinitions += colDef;
    });

    // 테이블 생성 쿼리
    const createTableQuery = `
      CREATE TABLE "${name}" (
        ${columnDefinitions}
      )
    `;

    console.log('테이블 생성 쿼리:', createTableQuery);

    // 테이블 생성 실행
    await sequelize.query(createTableQuery, {
      type: sequelize.QueryTypes.RAW
    });

    console.log(`테이블 ${name} 생성 완료`);

    res.json({
      success: true,
      message: `테이블 '${name}'이 성공적으로 생성되었습니다.`,
      tableName: name
    });

  } catch (error) {
    console.error(`테이블 ${name} 생성 실패:`, error);
    res.status(500).json({
      success: false,
      message: `테이블 '${name}' 생성에 실패했습니다.`,
      error: error.message
    });
  }
});

// DELETE /api/db-management/tables/:tableName - 테이블 삭제
router.delete('/tables/:tableName', async (req, res) => {
  const { tableName } = req.params;
  console.log(`테이블 삭제 요청: ${tableName}`);
  
  try {
    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ?
      )
    `, {
      replacements: [tableName],
      type: sequelize.QueryTypes.SELECT
    });

    if (!tableExists[0].exists) {
      return res.status(404).json({
        success: false,
        message: `테이블 '${tableName}'을 찾을 수 없습니다.`
      });
    }

    // 테이블 삭제 실행
    await sequelize.query(`DROP TABLE "${tableName}" CASCADE`, {
      type: sequelize.QueryTypes.RAW
    });

    console.log(`테이블 ${tableName} 삭제 완료`);

    res.json({
      success: true,
      message: `테이블 '${tableName}'이 성공적으로 삭제되었습니다.`,
      tableName: tableName
    });

  } catch (error) {
    console.error(`테이블 ${tableName} 삭제 실패:`, error);
    res.status(500).json({
      success: false,
      message: `테이블 '${tableName}' 삭제에 실패했습니다.`,
      error: error.message
    });
  }
});

module.exports = router;
