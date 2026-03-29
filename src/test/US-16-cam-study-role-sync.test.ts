import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSequelize, TestCamStudyUsers } from './test-setup.js';

const createMockMember = (roleIds: string[], overrides?: { id?: string; globalName?: string; username?: string }) => ({
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
});
