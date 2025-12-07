import { vi } from 'vitest';
import { Sequelize, DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';

// ============ 인메모리 DB 설정 ============
export const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// ============ Users 모델 ============
export class TestUsers extends Model<InferAttributes<TestUsers>, InferCreationAttributes<TestUsers>> {
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
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userid: { type: DataTypes.STRING(128), allowNull: false },
    username: { type: DataTypes.STRING(128), allowNull: false },
    yearmonth: { type: DataTypes.STRING(128), allowNull: false },
    waketime: { type: DataTypes.STRING(128), allowNull: false },
    vacances: { type: DataTypes.INTEGER, defaultValue: 5 },
    latecount: { type: DataTypes.INTEGER, defaultValue: 0 },
    absencecount: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize: testSequelize, tableName: 'users' },
);

// ============ TimeLog 모델 ============
export class TestTimeLog extends Model<InferAttributes<TestTimeLog>, InferCreationAttributes<TestTimeLog>> {
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
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING },
    yearmonthday: { type: DataTypes.STRING },
    checkintime: { type: DataTypes.STRING, allowNull: true },
    checkouttime: { type: DataTypes.STRING, allowNull: true },
    isintime: { type: DataTypes.BOOLEAN },
  },
  { sequelize: testSequelize, tableName: 'time_logs' },
);

// ============ CamStudyUsers 모델 ============
export class TestCamStudyUsers extends Model<
  InferAttributes<TestCamStudyUsers>,
  InferCreationAttributes<TestCamStudyUsers>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
}

TestCamStudyUsers.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING },
  },
  { sequelize: testSequelize, tableName: 'cam_study_users' },
);

// ============ CamStudyTimeLog 모델 ============
export class TestCamStudyTimeLog extends Model<
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
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING },
    yearmonthday: { type: DataTypes.STRING },
    timestamp: { type: DataTypes.STRING },
    totalminutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize: testSequelize, tableName: 'cam_study_time_logs' },
);

// ============ CamStudyWeeklyTimeLog 모델 ============
export class TestCamStudyWeeklyTimeLog extends Model<
  InferAttributes<TestCamStudyWeeklyTimeLog>,
  InferCreationAttributes<TestCamStudyWeeklyTimeLog>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare weektimes: number;
  declare totalminutes: number;
}

TestCamStudyWeeklyTimeLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING },
    weektimes: { type: DataTypes.INTEGER },
    totalminutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize: testSequelize, tableName: 'cam_study_weekly_time_logs' },
);

// ============ 모킹 설정 ============
vi.mock('../repository/Users.js', () => ({ Users: TestUsers }));
vi.mock('../repository/TimeLog.js', () => ({ TimeLog: TestTimeLog }));
vi.mock('../repository/CamStudyUsers.js', () => ({ CamStudyUsers: TestCamStudyUsers }));
vi.mock('../repository/CamStudyTimeLog.js', () => ({ CamStudyTimeLog: TestCamStudyTimeLog }));
vi.mock('../repository/CamStudyWeeklyTimeLog.js', () => ({ CamStudyWeeklyTimeLog: TestCamStudyWeeklyTimeLog }));
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// config.json 모킹
vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          checkChannelId: 'valid-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
        };
      }
      return original.createRequire(import.meta.url)(path);
    },
  };
});

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
  await TestCamStudyWeeklyTimeLog.destroy({ where: {} });
}

// ============ Mock Discord Interaction Factory ============
interface MockInteractionOptions {
  channelId?: string;
  userId?: string;
  globalName?: string;
  options?: Record<string, string | null>;
  attachment?: { url: string; name: string; contentType: string } | null;
}

export function createMockInteraction(opts: MockInteractionOptions = {}) {
  const replies: Array<string | { content: string; ephemeral?: boolean }> = [];

  return {
    channelId: opts.channelId ?? 'valid-channel-id',
    user: {
      id: opts.userId ?? 'test-user-id',
      globalName: opts.globalName ?? '테스트유저',
    },
    options: {
      getString: (name: string) => opts.options?.[name] ?? null,
      getAttachment: () => opts.attachment ?? null,
    },
    reply: async (content: string | { content: string; ephemeral?: boolean }) => {
      replies.push(content);
      return content;
    },
    channel: {
      send: vi.fn(),
    },
    getReplies: () => replies,
    getLastReply: () => {
      const last = replies[replies.length - 1];
      return typeof last === 'string' ? last : last?.content;
    },
  };
}

// ============ Mock VoiceState Factory ============
interface MockVoiceStateOptions {
  channelId?: string | null;
  streaming?: boolean;
  userId: string;
}

export function createMockVoiceState(opts: MockVoiceStateOptions) {
  const sendMock = vi.fn();
  return {
    channelId: opts.channelId ?? 'valid-voice-channel-id',
    streaming: opts.streaming ?? false,
    id: opts.userId,
    guild: {
      channels: {
        cache: {
          get: () => ({
            send: sendMock,
          }),
        },
      },
    },
    channel: {
      send: sendMock,
    },
    _sendMock: sendMock,
  };
}
