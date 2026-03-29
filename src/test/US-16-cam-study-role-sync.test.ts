import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSequelize, TestCamStudyActiveSession, TestCamStudyUsers } from './test-setup.js';

const createMockMember = (
  roleIds: string[],
  overrides?: {
    id?: string;
    globalName?: string;
    username?: string;
    voice?: { channelId?: string | null; selfVideo?: boolean; streaming?: boolean };
  },
) => ({
  id: overrides?.id ?? 'cam-user-123',
  user: {
    id: overrides?.id ?? 'cam-user-123',
    globalName: overrides?.globalName ?? '홍길동',
    username: overrides?.username ?? 'hong',
  },
  roles: {
    cache: {
      has: (roleId: string) => roleIds.includes(roleId),
    },
  },
  voice: {
    channelId: overrides?.voice?.channelId ?? null,
    selfVideo: overrides?.voice?.selfVideo ?? false,
    streaming: overrides?.voice?.streaming ?? false,
  },
});

describe('US-16: 캠스터디 역할 기반 자동 등록', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T10:00:00'));
    await TestCamStudyActiveSession.destroy({ where: {} });
    await TestCamStudyUsers.destroy({ where: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-CSRS01: guildMemberUpdate는 @cam-study 역할 추가 시 CamStudyUsers를 자동 등록한다', async () => {
    const oldMember = createMockMember([]);
    const newMember = createMockMember(['valid-cam-study-role-id']);

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
    expect(user?.username).toBe('홍길동');
  });

  it('TC-CSRS02: guildMemberUpdate는 @cam-study 역할 제거 시 CamStudyUsers에서 자동 해제한다', async () => {
    await TestCamStudyUsers.create({
      userid: 'cam-user-123',
      username: '홍길동',
    });

    const oldMember = createMockMember(['valid-cam-study-role-id']);
    const newMember = createMockMember([]);

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).toBeNull();
  });

  it('TC-CSRS04: 활성 세션 중 @cam-study 역할이 제거되면 CamStudyUsers 삭제를 종료 시점까지 미룬다', async () => {
    await TestCamStudyUsers.create({
      userid: 'cam-user-123',
      username: '홍길동',
    });

    const oldMember = createMockMember(['valid-cam-study-role-id'], {
      voice: { channelId: 'valid-voice-channel-id', streaming: true },
    });
    const newMember = createMockMember([], {
      voice: { channelId: 'valid-voice-channel-id', streaming: true },
    });

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
  });

  it('TC-CSRS03: guildMemberUpdate는 oldMember가 partial이어도 newMember 현재 역할 상태로 동기화한다', async () => {
    const oldMember = {
      partial: true,
      id: 'cam-user-123',
      user: {
        id: 'cam-user-123',
        globalName: '홍길동',
        username: 'hong',
      },
    };
    const newMember = createMockMember(['valid-cam-study-role-id']);

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
    expect(user?.username).toBe('홍길동');
  });

  it('TC-CSRS05: active session row가 남아 있으면 live voice flag가 꺼져도 revoke 삭제를 미룬다', async () => {
    await TestCamStudyUsers.create({
      userid: 'cam-user-123',
      username: '홍길동',
    });
    await TestCamStudyActiveSession.create({
      userid: 'cam-user-123',
      username: '홍길동',
      channelid: 'valid-voice-channel-id',
      startedat: '1711674000000',
      lastobservedat: '1711674300000',
    });

    const oldMember = createMockMember(['valid-cam-study-role-id'], {
      voice: { channelId: 'valid-voice-channel-id', selfVideo: false, streaming: false },
    });
    const newMember = createMockMember([], {
      voice: { channelId: 'valid-voice-channel-id', selfVideo: false, streaming: false },
    });

    const { event } = await import('../events/guildMemberUpdate.js');
    await event.execute(oldMember as never, newMember as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
  });
});
