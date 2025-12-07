/**
 * US-01: 회원 등록
 * 사용자는 기상 챌린지에 참여하기 위해 Discord에서 /register 명령어로 등록한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestUsers, createMockInteraction } from './test-setup.js';

describe('US-01: /register 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));
    await TestUsers.destroy({ where: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-R01: 신규 사용자 등록 성공', async () => {
    const interaction = createMockInteraction({
      options: {
        userid: 'new-user-123',
        yearmonth: '202512',
        waketime: '0700',
        username: '홍길동',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'new-user-123' } });
    expect(user).not.toBeNull();
    expect(user?.username).toBe('홍길동');
    expect(user?.waketime).toBe('0700');
    expect(user?.vacances).toBe(5);
    expect(interaction.getLastReply()).toContain('register success');
  });

  it('TC-R02: 기존 사용자 업데이트 성공', async () => {
    await TestUsers.create({
      userid: 'existing-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const interaction = createMockInteraction({
      options: {
        userid: 'existing-user',
        yearmonth: '202512',
        waketime: '0800',
        username: '홍길동',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'existing-user' } });
    expect(user?.waketime).toBe('0800');
    expect(interaction.getLastReply()).toContain('update success');
  });
});
