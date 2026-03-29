/**
 * US-07: 캠스터디 등록 명령 deprecated 안내
 * 운영자는 더 이상 /register-cam으로 참가자 원본을 직접 등록하지 않는다.
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

  it('TC-RC01: /register-cam은 역할 기반 등록으로 전환되었음을 안내한다', async () => {
    const { command } = await import('../commands/haruharu/register-cam.js');
    expect(command.data.toJSON().options?.map(option => option.required)).toEqual([false, false]);

    const interaction = createMockInteraction({
      options: {
        userid: 'cam-user-123',
        username: '홍길동',
      },
    });

    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'cam-user-123' } });
    expect(user).toBeNull();
    expect(interaction.getLastReply()).toContain('@cam-study');
  });

  it('TC-RC02: 기존 등록 여부와 관계없이 역할 부여 흐름으로 유도한다', async () => {
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

    const users = await TestCamStudyUsers.findAll({ where: { userid: 'cam-user-123' } });
    expect(users).toHaveLength(1);
    expect(interaction.getLastReply()).toContain('deprecated');
  });
});
