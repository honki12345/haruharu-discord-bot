import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TestCamStudyActiveSession,
  TestCamStudyTimeLog,
  TestCamStudyUsers,
  clearAllTables,
  testSequelize,
} from './test-setup.js';
import { reconcileCamStudyActiveSessions, syncCamStudyActiveSessionsFromClient } from '../services/camStudy.js';

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

  it('재기동 시 오늘 timelog 가 있고 아직 누적분이 없으면 그 timestamp 부터 복구를 이어간다', async () => {
    const existingStart = new Date('2025-12-07T10:15:00').getTime();
    await TestCamStudyTimeLog.create({
      userid: 'test-user-id',
      username: '테스트유저',
      yearmonthday: '20251207',
      timestamp: existingStart.toString(),
      totalminutes: 0,
    });

    await reconcileCamStudyActiveSessions(
      [{ channelId: 'valid-voice-channel-id', selfVideo: false, streaming: true, userId: 'test-user-id' }],
      'valid-voice-channel-id',
      'ready',
    );

    const activeSession = await TestCamStudyActiveSession.findOne({
      where: { userid: 'test-user-id' },
    });

    expect(activeSession).not.toBeNull();
    expect(activeSession?.startedat).toBe(existingStart.toString());
    expect(activeSession?.lastobservedat).toBe(new Date('2025-12-07T11:00:00').getTime().toString());
  });

  it('재기동 시 오늘 timelog 가 이미 누적된 완료 세션이면 recoveredAt 부터 새 session 으로 복구한다', async () => {
    const earlierCompletedAt = new Date('2025-12-07T09:30:00').getTime();
    const recoveredAt = new Date('2025-12-07T11:00:00').getTime();
    await TestCamStudyTimeLog.create({
      userid: 'test-user-id',
      username: '테스트유저',
      yearmonthday: '20251207',
      timestamp: earlierCompletedAt.toString(),
      totalminutes: 40,
    });

    await reconcileCamStudyActiveSessions(
      [{ channelId: 'valid-voice-channel-id', selfVideo: false, streaming: true, userId: 'test-user-id' }],
      'valid-voice-channel-id',
      'ready',
    );

    const activeSession = await TestCamStudyActiveSession.findOne({
      where: { userid: 'test-user-id' },
    });

    expect(activeSession).not.toBeNull();
    expect(activeSession?.startedat).toBe(recoveredAt.toString());
    expect(activeSession?.lastobservedat).toBe(recoveredAt.toString());
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

  it('voice channel snapshot 을 읽지 못하면 기존 active session 을 종료 정산하지 않는다', async () => {
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

    await syncCamStudyActiveSessionsFromClient(
      {
        channels: {
          cache: {
            get: () => null,
          },
          fetch: vi.fn().mockResolvedValue(null),
        },
      } as never,
      'valid-voice-channel-id',
      'heartbeat',
    );

    const activeSession = await TestCamStudyActiveSession.findOne({
      where: { userid: 'test-user-id' },
    });
    const log = await TestCamStudyTimeLog.findOne({
      where: { userid: 'test-user-id', yearmonthday: '20251207' },
    });

    expect(activeSession).not.toBeNull();
    expect(log?.totalminutes).toBe(0);
  });

  it('동시에 다른 경로가 먼저 닫은 stale session 은 중복 정산하지 않는다', async () => {
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

    const originalFindOne = TestCamStudyUsers.findOne.bind(TestCamStudyUsers);
    vi.spyOn(TestCamStudyUsers, 'findOne').mockImplementationOnce(async (...args) => {
      await TestCamStudyActiveSession.destroy({ where: { userid: 'test-user-id' } });
      return originalFindOne(...args);
    });

    await reconcileCamStudyActiveSessions([], 'valid-voice-channel-id', 'heartbeat');

    const log = await TestCamStudyTimeLog.findOne({
      where: { userid: 'test-user-id', yearmonthday: '20251207' },
    });

    expect(log?.totalminutes).toBe(0);
  });
});
