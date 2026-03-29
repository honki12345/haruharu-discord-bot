import { vi } from 'vitest';
import { Sequelize, DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const YEAR_MONTH_DAY_PATTERN = /^\d{8}$/;
const isValidIsoTimestamp = (value: string) => {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const canonical = parsed.toISOString();
  return value === canonical || value === canonical.replace('.000Z', 'Z');
};
const isValidYearMonthDay = (value: string) => {
  if (!YEAR_MONTH_DAY_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const date = Number(value.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, date));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === date;
};

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
  {
    sequelize: testSequelize,
    tableName: 'users',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonth'],
      },
    ],
  },
);

export class TestChallengeUserExclusion extends Model<
  InferAttributes<TestChallengeUserExclusion>,
  InferCreationAttributes<TestChallengeUserExclusion>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare yearmonth: string;
}

TestChallengeUserExclusion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userid: { type: DataTypes.STRING(128), allowNull: false },
    yearmonth: { type: DataTypes.STRING(128), allowNull: false },
  },
  {
    sequelize: testSequelize,
    tableName: 'challenge_user_exclusions',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonth'],
      },
    ],
  },
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

// ============ AttendanceLog 모델 ============
export class TestAttendanceLog extends Model<
  InferAttributes<TestAttendanceLog>,
  InferCreationAttributes<TestAttendanceLog>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare threadid: string;
  declare messageid: string;
  declare commentedat: string;
  declare status: 'attended' | 'late' | 'absent';
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TestAttendanceLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING(128), allowNull: false },
    username: { type: DataTypes.STRING(128), allowNull: false },
    yearmonthday: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        isCanonicalYearMonthDay(value: string) {
          if (!isValidYearMonthDay(value)) {
            throw new Error('yearmonthday must be a canonical yyyymmdd date');
          }
        },
      },
    },
    threadid: { type: DataTypes.STRING(128), allowNull: false },
    messageid: { type: DataTypes.STRING(128), allowNull: false },
    commentedat: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIsoTimestamp(value: string) {
          if (!isValidIsoTimestamp(value)) {
            throw new Error('commentedat must be an ISO-8601 UTC timestamp');
          }
        },
      },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['attended', 'late', 'absent']],
      },
    },
  },
  {
    sequelize: testSequelize,
    tableName: 'attendance_logs',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonthday'],
      },
    ],
  },
);

// ============ VacationLog 모델 ============
export class TestVacationLog extends Model<InferAttributes<TestVacationLog>, InferCreationAttributes<TestVacationLog>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TestVacationLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING(128), allowNull: false },
    username: { type: DataTypes.STRING(128), allowNull: false },
    yearmonthday: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        isCanonicalYearMonthDay(value: string) {
          if (!isValidYearMonthDay(value)) {
            throw new Error('yearmonthday must be a canonical yyyymmdd date');
          }
        },
      },
    },
  },
  {
    sequelize: testSequelize,
    tableName: 'vacation_logs',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonthday'],
      },
    ],
  },
);

// ============ WaketimeChangeLog 모델 ============
export class TestWaketimeChangeLog extends Model<
  InferAttributes<TestWaketimeChangeLog>,
  InferCreationAttributes<TestWaketimeChangeLog>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare yearmonthday: string;
  declare waketime: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TestWaketimeChangeLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING(128), allowNull: false },
    yearmonthday: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        isCanonicalYearMonthDay(value: string) {
          if (!isValidYearMonthDay(value)) {
            throw new Error('yearmonthday must be a canonical yyyymmdd date');
          }
        },
      },
    },
    waketime: { type: DataTypes.STRING(4), allowNull: false },
  },
  {
    sequelize: testSequelize,
    tableName: 'waketime_change_logs',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonthday'],
      },
    ],
  },
);

// ============ WakeUpMembership 모델 ============
export class TestWakeUpMembership extends Model<
  InferAttributes<TestWakeUpMembership>,
  InferCreationAttributes<TestWakeUpMembership>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare waketime: string;
  declare status: 'active' | 'stopped';
  declare stoppedat: string | null;
}

TestWakeUpMembership.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    username: { type: DataTypes.STRING(128), allowNull: false },
    waketime: { type: DataTypes.STRING(4), allowNull: false },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [['active', 'stopped']],
      },
    },
    stoppedat: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize: testSequelize, tableName: 'wake_up_memberships' },
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

// ============ CamStudyActiveSession 모델 ============
export class TestCamStudyActiveSession extends Model<
  InferAttributes<TestCamStudyActiveSession>,
  InferCreationAttributes<TestCamStudyActiveSession>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare channelid: string;
  declare startedat: string;
  declare lastobservedat: string;
}

TestCamStudyActiveSession.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: { type: DataTypes.STRING, unique: true },
    username: { type: DataTypes.STRING },
    channelid: { type: DataTypes.STRING },
    startedat: { type: DataTypes.STRING },
    lastobservedat: { type: DataTypes.STRING },
  },
  { sequelize: testSequelize, tableName: 'cam_study_active_sessions' },
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
vi.mock('../repository/ChallengeUserExclusion.js', () => ({ ChallengeUserExclusion: TestChallengeUserExclusion }));
vi.mock('../repository/TimeLog.js', () => ({ TimeLog: TestTimeLog }));
vi.mock('../repository/AttendanceLog.js', () => ({ AttendanceLog: TestAttendanceLog }));
vi.mock('../repository/VacationLog.js', () => ({ VacationLog: TestVacationLog }));
vi.mock('../repository/WaketimeChangeLog.js', () => ({ WaketimeChangeLog: TestWaketimeChangeLog }));
vi.mock('../repository/WakeUpMembership.js', () => ({ WakeUpMembership: TestWakeUpMembership }));
vi.mock('../repository/CamStudyUsers.js', () => ({ CamStudyUsers: TestCamStudyUsers }));
vi.mock('../repository/CamStudyTimeLog.js', () => ({ CamStudyTimeLog: TestCamStudyTimeLog }));
vi.mock('../repository/CamStudyActiveSession.js', () => ({ CamStudyActiveSession: TestCamStudyActiveSession }));
vi.mock('../repository/CamStudyWeeklyTimeLog.js', () => ({ CamStudyWeeklyTimeLog: TestCamStudyWeeklyTimeLog }));
vi.mock('../logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// config.json 모킹
vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          token: 'test-token',
          clientId: 'test-client-id',
          guildId: 'test-guild-id',
          databaseUser: 'test-db-user',
          password: 'test-db-password',
          noticeChannelId: 'valid-notice-channel-id',
          vacancesRegisterChannelId: 'valid-vacances-channel-id',
          checkChannelId: 'valid-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
          applyChannelId: 'valid-apply-channel-id',
          opsChannelId: 'valid-ops-channel-id',
          wakeUpRoleId: 'valid-wake-up-role-id',
          camStudyRoleId: 'valid-cam-study-role-id',
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
  const existingTables = new Set(
    (await testSequelize.getQueryInterface().showAllTables()).map(table => table.toString()),
  );
  const models = [
    TestTimeLog,
    TestAttendanceLog,
    TestVacationLog,
    TestWaketimeChangeLog,
    TestWakeUpMembership,
    TestChallengeUserExclusion,
    TestUsers,
    TestCamStudyTimeLog,
    TestCamStudyActiveSession,
    TestCamStudyUsers,
    TestCamStudyWeeklyTimeLog,
  ];

  for (const model of models) {
    const tableName = model.getTableName().toString();

    if (!existingTables.has(tableName)) {
      continue;
    }

    await model.destroy({ where: {} });
  }
}

// ============ Mock Discord Interaction Factory ============
interface MockInteractionOptions {
  channelId?: string;
  userId?: string;
  globalName?: string;
  username?: string;
  options?: Record<string, string | null>;
  attachment?: { url: string; name: string; contentType: string } | null;
  member?: {
    roles: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
    send: ReturnType<typeof vi.fn>;
  };
  guild?: {
    members: {
      fetch: ReturnType<typeof vi.fn>;
    };
  };
  client?: {
    channels: {
      fetch: ReturnType<typeof vi.fn>;
    };
    users?: {
      fetch: ReturnType<typeof vi.fn>;
    };
  };
}

export function createMockInteraction(opts: MockInteractionOptions = {}) {
  const replies: Array<string | { content: string; ephemeral?: boolean }> = [];
  const user = {
    id: opts.userId ?? 'test-user-id',
    globalName: opts.globalName ?? '테스트유저',
    username: opts.username ?? 'test-username',
  };
  const member = opts.member ?? {
    roles: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    send: vi.fn(),
  };
  const guild = opts.guild ?? {
    members: {
      fetch: vi.fn().mockResolvedValue(member),
    },
  };

  return {
    channelId: opts.channelId ?? 'valid-channel-id',
    user,
    member,
    guild,
    options: {
      getString: (name: string) => opts.options?.[name] ?? null,
      getAttachment: () => opts.attachment ?? null,
    },
    client: opts.client ?? {
      channels: {
        fetch: vi.fn(),
      },
      users: {
        fetch: vi.fn().mockResolvedValue({
          id: user.id,
          username: user.username,
          globalName: user.globalName,
          send: vi.fn(),
        }),
      },
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
  selfVideo?: boolean;
  streaming?: boolean;
  userId: string;
}

export function createMockVoiceState(opts: MockVoiceStateOptions) {
  const sendMock = vi.fn();
  const channelId = opts.channelId !== undefined ? opts.channelId : 'valid-voice-channel-id';
  return {
    channelId,
    selfVideo: opts.selfVideo ?? false,
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
    channel: channelId ? { send: sendMock } : null,
    _sendMock: sendMock,
  };
}
