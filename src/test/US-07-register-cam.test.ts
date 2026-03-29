/**
 * US-07: 캠스터디 등록
 * 관리자의 수동 /register-cam 은 deprecated 상태를 유지한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestCamStudyUsers, createMockInteraction } from './test-setup.js';

describe('US-07: /register-cam 커맨드', () => {
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

  it('TC-RC01: /register-cam 은 DB를 바꾸지 않고 self-service 흐름 안내만 반환한다', async () => {
    const interaction = createMockInteraction({
      options: {
        userid: 'cam-user-123',
        username: '홍길동',
      },
    });

    const { command } = await import('../commands/haruharu/register-cam.js');
    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).toBeNull();
    expect(interaction.getLastReply()).toContain('/apply-cam');
    expect(interaction.getLastReply()).toContain('deprecated');
  });
});
