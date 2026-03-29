/**
 * US-11: 캠스터디 탈퇴
 * 관리자의 수동 /delete-cam 은 deprecated 상태를 유지한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestCamStudyUsers, createMockInteraction } from './test-setup.js';

describe('US-11: /delete-cam 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T10:00:00'));
    await TestCamStudyUsers.destroy({ where: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-DC01: /delete-cam 은 기존 row 를 직접 지우지 않고 역할 기반 해제를 안내한다', async () => {
    await TestCamStudyUsers.create({
      userid: 'cam-user-123',
      username: '홍길동',
    });

    const interaction = createMockInteraction({
      options: {
        userid: 'cam-user-123',
      },
    });

    const { command } = await import('../commands/haruharu/delete-cam.js');
    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
    expect(interaction.getLastReply()).toContain('@cam-study');
    expect(interaction.getLastReply()).toContain('deprecated');
  });
});
