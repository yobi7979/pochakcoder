const { sequelize, UserSportPermission } = require('./models');

async function migrateUserSportPermissions() {
  try {
    console.log('사용자별 종목 권한 테이블 마이그레이션 시작...');
    
    // UserSportPermission 테이블이 이미 존재하는지 확인
    const tableExists = await sequelize.getQueryInterface().showAllTables()
      .then(tables => tables.includes('UserSportPermissions'));
    
    if (!tableExists) {
      console.log('UserSportPermissions 테이블을 생성합니다...');
      
      // 테이블 생성
      await sequelize.getQueryInterface().createTable('UserSportPermissions', {
        id: {
          type: 'INTEGER',
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: 'INTEGER',
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        sport_id: {
          type: 'INTEGER',
          allowNull: false,
          references: {
            model: 'Sports',
            key: 'id'
          }
        },
        created_at: {
          type: 'DATETIME',
          allowNull: false,
          defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: 'DATETIME',
          allowNull: false,
          defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      
      // 인덱스 생성
      await sequelize.getQueryInterface().addIndex('UserSportPermissions', {
        fields: ['user_id', 'sport_id'],
        unique: true,
        name: 'UserSportPermissions_user_id_sport_id_unique'
      });
      
      console.log('UserSportPermissions 테이블이 성공적으로 생성되었습니다.');
    } else {
      console.log('UserSportPermissions 테이블이 이미 존재합니다.');
    }
    
    console.log('마이그레이션이 완료되었습니다.');
    process.exit(0);
    
  } catch (error) {
    console.error('마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }
}

// 마이그레이션 실행
migrateUserSportPermissions();
