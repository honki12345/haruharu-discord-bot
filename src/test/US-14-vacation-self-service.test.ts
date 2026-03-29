/**
 * US-14: 사용자 직접 휴가 등록
 * 사용자는 /apply-vacation 명령어로 자신의 휴가를 직접 관리한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  testSequelize,
  TestUsers,
  TestVacationLog,
  TestWakeUpMembership,
  clearAllTables,
  createMockInteraction,
} from './test-setup.js';

describe('US-14: 사용자 휴가 등록 self-service 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-VS01: 등록된 사용자는 잔여 휴가가 있으면 특정 날짜에 휴가를 등록할 수 있다', async () => {
    await TestUsers.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 2,
      latecount: 0,
      absencecount: 0,
    });

    const interaction = createMockInteraction({
      userId: 'self-user',
      options: {
        date: '20251208',
      },
    });

    const { command } = await import('../commands/haruharu/apply-vacation.js');
    await command.execute(interaction as never);

    const vacationLog = await TestVacationLog.findOne({
      where: { userid: 'self-user', yearmonthday: '20251208' },
    });

    expect(vacationLog).not.toBeNull();
    expect(interaction.getLastReply()).toContain('휴가를 등록');
  });

  it('TC-VS02: 같은 날짜에는 중복으로 휴가를 등록할 수 없다', async () => {
    await TestUsers.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 2,
      latecount: 0,
      absencecount: 0,
    });

    await TestVacationLog.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonthday: '20251208',
    });

    const interaction = createMockInteraction({
      userId: 'self-user',
      options: {
        date: '20251208',
      },
    });

    const { command } = await import('../commands/haruharu/apply-vacation.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('이미 휴가를 등록');
  });

  it('TC-VS03: 잔여 휴가가 없으면 새 휴가 등록이 거부된다', async () => {
    await TestUsers.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 1,
      latecount: 0,
      absencecount: 0,
    });

    await TestVacationLog.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonthday: '20251208',
    });

    const interaction = createMockInteraction({
      userId: 'self-user',
      options: {
        date: '20251209',
      },
    });

    const { command } = await import('../commands/haruharu/apply-vacation.js');
    await command.execute(interaction as never);

    const vacationLog = await TestVacationLog.findOne({
      where: { userid: 'self-user', yearmonthday: '20251209' },
    });

    expect(vacationLog).toBeNull();
    expect(interaction.getLastReply()).toContain('잔여 휴가가 없습니다');
  });

  it('TC-VS04: 현재 월이 아닌 날짜로는 휴가를 신청할 수 없다', async () => {
    await TestWakeUpMembership.create({
      userid: 'self-user',
      username: '홍길동',
      waketime: '0700',
      status: 'active',
      stoppedat: null,
    });

    const interaction = createMockInteraction({
      userId: 'self-user',
      options: {
        date: '20260108',
      },
    });

    const { command } = await import('../commands/haruharu/apply-vacation.js');
    await command.execute(interaction as never);

    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'self-user', yearmonth: '202601' },
    });
    const vacationLog = await TestVacationLog.findOne({
      where: { userid: 'self-user', yearmonthday: '20260108' },
    });

    expect(currentMonthUser).toBeNull();
    expect(vacationLog).toBeNull();
    expect(interaction.getLastReply()).toContain('현재 월 날짜만');
  });
});
