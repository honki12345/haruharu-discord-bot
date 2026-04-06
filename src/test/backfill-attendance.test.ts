import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TestAttendanceLog, TestUsers, clearAllTables, testSequelize } from './test-setup.js';

const mockClient = {
  login: vi.fn(),
  destroy: vi.fn(),
  channels: {
    fetch: vi.fn(),
  },
};

const mockCreateClient = vi.fn(() => mockClient);
const mockSequelizeClose = vi.fn();

vi.mock('../config.js', () => ({
  token: 'test-token',
}));

vi.mock('../runtime.js', () => ({
  createClient: mockCreateClient,
}));

vi.mock('../repository/config.js', () => ({
  sequelize: {
    close: mockSequelizeClose,
  },
}));

const originalArgv = [...process.argv];
const createdTempDirs: string[] = [];

const writeBackfillInput = (entries: Array<{ threadId: string; messageId: string; userId: string }>) => {
  const directory = mkdtempSync(join(tmpdir(), 'backfill-attendance-test-'));
  const inputPath = join(directory, 'input.json');

  writeFileSync(inputPath, JSON.stringify({ entries }, null, 2));
  createdTempDirs.push(directory);

  return inputPath;
};

const runBackfillScript = async (inputPath: string) => {
  process.argv = ['node', 'src/backfill-attendance.ts', inputPath];
  vi.resetModules();

  await import('../backfill-attendance.js');
  await vi.waitFor(() => {
    expect(mockClient.destroy).toHaveBeenCalledTimes(1);
  });
};

describe('attendance backfill helper', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    await clearAllTables();
    process.argv = [...originalArgv];
    process.exitCode = undefined;

    mockCreateClient.mockClear();
    mockSequelizeClose.mockReset();
    mockSequelizeClose.mockResolvedValue(undefined);
    mockClient.login.mockReset();
    mockClient.login.mockResolvedValue(undefined);
    mockClient.destroy.mockReset();
    mockClient.channels.fetch.mockReset();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    process.exitCode = undefined;

    for (const directory of createdTempDirs.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('KST 기준 얼리 댓글도 AttendanceLog(status=attended)로 저장하고 ✅와 🌅 반응을 단다', async () => {
    await TestUsers.create({
      userid: 'early-user',
      username: '얼리버드',
      yearmonth: '202603',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const react = vi.fn().mockResolvedValue(undefined);
    const inputPath = writeBackfillInput([
      {
        threadId: 'thread-early',
        messageId: 'message-early',
        userId: 'early-user',
      },
    ]);

    mockClient.channels.fetch.mockResolvedValue({
      isThread: () => true,
      messages: {
        fetch: vi.fn().mockResolvedValue({
          id: 'message-early',
          author: { id: 'early-user' },
          createdTimestamp: new Date('2026-03-24T21:40:00.000Z').getTime(),
          react,
        }),
      },
    });

    await runBackfillScript(inputPath);

    const attendanceLog = await TestAttendanceLog.findOne({
      where: {
        userid: 'early-user',
        yearmonthday: '20260325',
      },
    });

    expect(attendanceLog).not.toBeNull();
    expect(attendanceLog?.status).toBe('attended');
    expect(attendanceLog?.messageid).toBe('message-early');
    expect(react).toHaveBeenNthCalledWith(1, '✅');
    expect(react).toHaveBeenNthCalledWith(2, '🌅');
    expect(react).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBeUndefined();
  });

  it('기존 공식 AttendanceLog가 있으면 얼리 댓글 backfill도 실패한다', async () => {
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await TestUsers.create({
      userid: 'early-user',
      username: '얼리버드',
      yearmonth: '202603',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestAttendanceLog.create({
      userid: 'early-user',
      username: '얼리버드',
      yearmonthday: '20260325',
      threadid: 'thread-existing',
      messageid: 'message-existing',
      commentedat: '2026-03-24T21:50:00.000Z',
      status: 'attended',
    });

    const react = vi.fn().mockResolvedValue(undefined);
    const inputPath = writeBackfillInput([
      {
        threadId: 'thread-early',
        messageId: 'message-early',
        userId: 'early-user',
      },
    ]);

    mockClient.channels.fetch.mockResolvedValue({
      isThread: () => true,
      messages: {
        fetch: vi.fn().mockResolvedValue({
          id: 'message-early',
          author: { id: 'early-user' },
          createdTimestamp: new Date('2026-03-24T21:40:00.000Z').getTime(),
          react,
        }),
      },
    });

    await runBackfillScript(inputPath);

    await vi.waitFor(() => {
      expect(process.exitCode).toBe(1);
    });

    expect(stderrWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'AttendanceLog already exists for early-user on 20260325 with another message: message-existing',
      ),
    );
    expect(react).not.toHaveBeenCalled();

    const attendanceLogs = await TestAttendanceLog.findAll({
      where: {
        userid: 'early-user',
        yearmonthday: '20260325',
      },
    });

    expect(attendanceLogs).toHaveLength(1);
    expect(attendanceLogs[0]?.messageid).toBe('message-existing');

    stderrWriteSpy.mockRestore();
  });
});
