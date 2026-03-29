/**
 * US-07: 캠스터디 등록
 * 사용자는 캠스터디에 참여하기 위해 /register-cam 명령어로 등록한다.
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

  it('TC-RC01: 캠스터디 등록 성공', async () => {
    const interaction = createMockInteraction({
      options: {
        userid: 'cam-user-123',
        username: '홍길동',
      },
    });

    const { command } = await import('../commands/haruharu/register-cam.js');
    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).not.toBeNull();
    expect(user?.username).toBe('홍길동');
    expect(interaction.getLastReply()).toContain('캠스터디 참가자로 등록했습니다');
  });

  it('TC-RC02: 이미 등록된 사용자는 중복 생성하지 않고 한 번만 실패 응답한다', async () => {
    await TestCamStudyUsers.create({
      userid: 'cam-user-123',
      username: '홍길동',
    });

    const interaction = createMockInteraction({
      options: {
        userid: 'cam-user-123',
        username: '홍길동',
      },
    });

    const { command } = await import('../commands/haruharu/register-cam.js');
    await command.execute(interaction as never);

    const replies = interaction.getReplies();
    const userCount = await TestCamStudyUsers.count({ where: { userid: 'cam-user-123' } });

    expect(userCount).toBe(1);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain('이미 존재');
  });
});
