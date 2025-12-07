/**
 * US-11: 캠스터디 탈퇴
 * 사용자는 /delete-cam 명령어로 캠스터디에서 탈퇴한다.
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

  it('TC-DC01: 캠스터디 탈퇴 성공', async () => {
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
    expect(user).toBeNull();
  });

  it('TC-DC02: 미등록 사용자 삭제 시도', async () => {
    const interaction = createMockInteraction({
      options: {
        userid: 'nonexistent-user',
      },
    });

    const { command } = await import('../commands/haruharu/delete-cam.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('존재하지 않');
  });
});
