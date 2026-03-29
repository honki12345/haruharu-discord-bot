import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TestCamStudyActiveSession,
  TestCamStudyTimeLog,
  TestCamStudyUsers,
  clearAllTables,
  testSequelize,
} from './test-setup.js';
import { processCamStudyStateChange } from '../services/camStudy.js';
import { resetCamStudyRoleSyncState } from '../services/camStudyRoleSync.js';

const createMockMember = ({
  hasRole,
  partial = false,
  username = '테스트유저',
  userId = 'test-user-id',
  fetchResult,
}: {
  hasRole: boolean;
  partial?: boolean;
  username?: string;
  userId?: string;
  fetchResult?: unknown;
}) => ({
  partial,
  id: userId,
  displayName: username,
  user: {
    id: userId,
    globalName: username,
    username,
  },
  roles: {
    cache: hasRole ? new Map([['valid-cam-study-role-id', {}]]) : new Map(),
  },
  fetch: vi.fn().mockResolvedValue(fetchResult),
});

describe('US-16: cam-study 역할 기반 자동 등록/해제', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T10:30:00'));
    resetCamStudyRoleSyncState();
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cam-study 역할이 부여되면 guildMemberUpdate 로 CamStudyUsers 가 생성된다', async () => {
    const oldMember = createMockMember({ hasRole: false });
    const newMember = createMockMember({ hasRole: true });

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const rows = await TestCamStudyUsers.findAll({ where: { userid: 'test-user-id' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.username).toBe('테스트유저');
  });

  it('partial member 여도 fetch fallback 으로 역할 제거를 감지해 즉시 해제한다', async () => {
    await TestCamStudyUsers.create({
      userid: 'test-user-id',
      username: '테스트유저',
    });

    const oldMember = createMockMember({ hasRole: true });
    const fetchedMember = createMockMember({ hasRole: false, partial: false });
    const newMember = createMockMember({ hasRole: false, partial: true, fetchResult: fetchedMember });

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const row = await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(row).toBeNull();
    expect(newMember.fetch).toHaveBeenCalled();
  });

  it('역할이 제거돼도 active session 이 있으면 종료 시점까지 row 삭제를 defer 한다', async () => {
    const startedAt = new Date('2025-12-07T10:00:00').getTime();
    await TestCamStudyUsers.create({
      userid: 'test-user-id',
      username: '테스트유저',
    });
    await TestCamStudyTimeLog.create({
      userid: 'test-user-id',
      username: '테스트유저',
      yearmonthday: '20251207',
      timestamp: startedAt.toString(),
      totalminutes: 0,
    });
    await TestCamStudyActiveSession.create({
      userid: 'test-user-id',
      username: '테스트유저',
      channelid: 'valid-voice-channel-id',
      startedat: startedAt.toString(),
      lastobservedat: startedAt.toString(),
    });

    const oldMember = createMockMember({ hasRole: true });
    const newMember = createMockMember({ hasRole: false });

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    expect(await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } })).not.toBeNull();

    vi.setSystemTime(new Date('2025-12-07T10:30:00'));
    await processCamStudyStateChange(
      {
        channelId: 'valid-voice-channel-id',
        selfVideo: false,
        streaming: true,
        userId: 'test-user-id',
      },
      {
        channelId: 'valid-voice-channel-id',
        selfVideo: false,
        streaming: false,
        userId: 'test-user-id',
      },
      'valid-voice-channel-id',
    );

    expect(await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } })).toBeNull();
    const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id', yearmonthday: '20251207' } });
    expect(log?.totalminutes).toBe(30);
  });
});
