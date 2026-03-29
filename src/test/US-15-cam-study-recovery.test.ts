import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TestCamStudyActiveSession,
  TestCamStudyTimeLog,
  TestCamStudyUsers,
  clearAllTables,
  testSequelize,
} from './test-setup.js';
import { reconcileCamStudyActiveSessions } from '../services/camStudy.js';

describe('US-15: 재배포 후 캠스터디 active session 복구', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T11:00:00'));
    await clearAllTables();
    await TestCamStudyUsers.create({
      userid: 'test-user-id',
      username: '테스트유저',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('재기동 시 live voice state 에만 있는 활성 사용자는 active session 으로 복구한다', async () => {
    await reconcileCamStudyActiveSessions(
      [{ channelId: 'valid-voice-channel-id', selfVideo: false, streaming: true, userId: 'test-user-id' }],
      'valid-voice-channel-id',
      'ready',
    );

    const activeSession = await TestCamStudyActiveSession.findOne({
      where: { userid: 'test-user-id' },
    });

    expect(activeSession).not.toBeNull();
    expect(activeSession?.startedat).toBe(new Date('2025-12-07T11:00:00').getTime().toString());
    expect(activeSession?.lastobservedat).toBe(new Date('2025-12-07T11:00:00').getTime().toString());
  });

  it('재기동 시 live voice state 에 없는 열린 session 은 마지막 관측 시각으로 종료 정산한다', async () => {
    const startedAt = new Date('2025-12-07T10:00:00').getTime();
    const lastObservedAt = new Date('2025-12-07T10:30:00').getTime();

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
      lastobservedat: lastObservedAt.toString(),
    });

    await reconcileCamStudyActiveSessions([], 'valid-voice-channel-id', 'ready');

    const activeSession = await TestCamStudyActiveSession.findOne({
      where: { userid: 'test-user-id' },
    });
    const log = await TestCamStudyTimeLog.findOne({
      where: { userid: 'test-user-id', yearmonthday: '20251207' },
    });

    expect(activeSession).toBeNull();
    expect(log?.totalminutes).toBe(30);
  });

  it('같은 live voice state 로 복구를 두 번 실행해도 active session 이 중복 생성되지 않는다', async () => {
    const snapshots = [
      { channelId: 'valid-voice-channel-id', selfVideo: false, streaming: true, userId: 'test-user-id' },
    ];

    await reconcileCamStudyActiveSessions(snapshots, 'valid-voice-channel-id', 'ready');
    await reconcileCamStudyActiveSessions(snapshots, 'valid-voice-channel-id', 'heartbeat');

    const activeSessions = await TestCamStudyActiveSession.findAll({
      where: { userid: 'test-user-id' },
    });

    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0]?.startedat).toBe(new Date('2025-12-07T11:00:00').getTime().toString());
    expect(activeSessions[0]?.lastobservedat).toBe(new Date('2025-12-07T11:00:00').getTime().toString());
  });
});
