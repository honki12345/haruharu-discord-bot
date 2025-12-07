import { Sequelize, DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';

// 테스트용 인메모리 SQLite 인스턴스
export const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// ============ Users 모델 ============
class TestUsers extends Model<InferAttributes<TestUsers>, InferCreationAttributes<TestUsers>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonth: string;
  declare waketime: string;
  declare vacances: number;
  declare latecount: number;
  declare absencecount: number;
}

TestUsers.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userid: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    username: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    yearmonth: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    waketime: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    vacances: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    latecount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    absencecount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize: testSequelize,
    tableName: 'users',
  },
);

// ============ TimeLog 모델 ============
class TestTimeLog extends Model<InferAttributes<TestTimeLog>, InferCreationAttributes<TestTimeLog>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare checkintime: string | null;
  declare checkouttime: string | null;
  declare isintime: boolean;
}

TestTimeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: DataTypes.STRING,
    },
    username: {
      type: DataTypes.STRING,
    },
    yearmonthday: {
      type: DataTypes.STRING,
    },
    checkintime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    checkouttime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isintime: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    sequelize: testSequelize,
    tableName: 'time_logs',
  },
);

// ============ CamStudyUsers 모델 ============
class TestCamStudyUsers extends Model<InferAttributes<TestCamStudyUsers>, InferCreationAttributes<TestCamStudyUsers>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
}

TestCamStudyUsers.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: DataTypes.STRING,
    },
    username: {
      type: DataTypes.STRING,
    },
  },
  {
    sequelize: testSequelize,
    tableName: 'cam_study_users',
  },
);

// ============ CamStudyTimeLog 모델 ============
class TestCamStudyTimeLog extends Model<
  InferAttributes<TestCamStudyTimeLog>,
  InferCreationAttributes<TestCamStudyTimeLog>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare timestamp: string;
  declare totalminutes: number;
}

TestCamStudyTimeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: DataTypes.STRING,
    },
    username: {
      type: DataTypes.STRING,
    },
    yearmonthday: {
      type: DataTypes.STRING,
    },
    timestamp: {
      type: DataTypes.STRING,
    },
    totalminutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize: testSequelize,
    tableName: 'cam_study_time_logs',
  },
);

// ============ 헬퍼 함수 ============
export async function setupTestDB() {
  await testSequelize.sync({ force: true });
}

export async function teardownTestDB() {
  await testSequelize.close();
}

export async function clearAllTables() {
  await TestTimeLog.destroy({ where: {} });
  await TestUsers.destroy({ where: {} });
  await TestCamStudyTimeLog.destroy({ where: {} });
  await TestCamStudyUsers.destroy({ where: {} });
}

export { TestUsers, TestTimeLog, TestCamStudyUsers, TestCamStudyTimeLog };
