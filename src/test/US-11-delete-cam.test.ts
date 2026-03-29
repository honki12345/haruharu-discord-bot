/**
 * US-11: 캠스터디 삭제 명령 deprecated 안내
 * 운영자는 더 이상 /delete-cam으로 참가자 원본을 직접 제거하지 않는다.
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

  it('TC-DC01: /delete-cam은 역할 회수로 전환되었음을 안내한다', async () => {
    const { command } = await import('../commands/haruharu/delete-cam.js');
    expect(command.data.toJSON().options?.map(option => option.required)).toEqual([false]);

    await TestCamStudyUsers.create({
      userid: 'cam-user-123',
      username: '홍길동',
    });

    const interaction = createMockInteraction({
      options: {
        userid: 'cam-user-123',
      },
    });

    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
    expect(interaction.getLastReply()).toContain('@cam-study');
  });

  it('TC-DC02: 미등록 사용자여도 역할 회수 흐름을 안내한다', async () => {
    const interaction = createMockInteraction({
      options: {
        userid: 'nonexistent-user',
      },
    });

    const { command } = await import('../commands/haruharu/delete-cam.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('deprecated');
  });
});
