/**
 * US-04: 휴가 추가
 * 관리자는 /add-vacances 명령어로 회원에게 휴가를 부여한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestUsers, createMockInteraction } from './test-setup.js';

describe('US-04: /add-vacances 커맨드', () => {
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

  it('TC-V01: 휴가 추가 성공', async () => {
    await TestUsers.create({
      userid: 'test-user-id',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const interaction = createMockInteraction({
      options: {
        userid: 'test-user-id',
        yearmonth: '202512',
        count: '2',
      },
    });

    const { command } = await import('../commands/haruharu/add-vacances.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(user?.vacances).toBe(7);
    expect(interaction.getLastReply()).toContain('7');
  });

  it('TC-V02: 미등록 사용자', async () => {
    const interaction = createMockInteraction({
      options: {
        userid: 'nonexistent-user',
        yearmonth: '202512',
        count: '2',
      },
    });

    const { command } = await import('../commands/haruharu/add-vacances.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('존재하지 않는 회원');
  });

  it('TC-V03: 음수 휴가 추가 (휴가 차감)', async () => {
    await TestUsers.create({
      userid: 'test-user-id',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const interaction = createMockInteraction({
      options: {
        userid: 'test-user-id',
        yearmonth: '202512',
        count: '-2',
      },
    });

    const { command } = await import('../commands/haruharu/add-vacances.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(user?.vacances).toBe(3);
  });
});
