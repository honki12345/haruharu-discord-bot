import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TestUsers,
  TestVacationLog,
  TestWakeUpMembership,
  clearAllTables,
  createMockInteraction,
  testSequelize,
} from './test-setup.js';

describe('US-16: 기상스터디 상시 참여와 중단', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-08T07:05:00Z'));
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-WM01: 이전 달에 등록한 활성 사용자는 새 달 리포트 시 현재 월 스냅샷이 자동 생성된다', async () => {
    await TestWakeUpMembership.create({
      userid: 'active-user',
      username: '홍길동',
      waketime: '0700',
      status: 'active',
      stoppedat: null,
    });

    const { buildChallengeReport } = await import('../services/reporting.js');
    const { attendanceMessage } = await buildChallengeReport();

    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'active-user', yearmonth: '202601' },
    });

    expect(currentMonthUser).not.toBeNull();
    expect(currentMonthUser?.waketime).toBe('0700');
    expect(attendanceMessage).toContain('홍길동: 결석');
  });

  it('TC-WM02: 활성 사용자는 현재 월 휴가 신청 시 현재 월 스냅샷이 없어도 자동으로 생성된다', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:05:00Z'));
    await TestWakeUpMembership.create({
      userid: 'vacation-user',
      username: '김영희',
      waketime: '0630',
      status: 'active',
      stoppedat: null,
    });

    const interaction = createMockInteraction({
      userId: 'vacation-user',
      globalName: '김영희',
      options: {
        date: '20251209',
      },
    });

    const { command } = await import('../commands/haruharu/apply-vacation.js');
    await command.execute(interaction as never);

    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'vacation-user', yearmonth: '202512' },
    });
    const vacationLog = await TestVacationLog.findOne({
      where: { userid: 'vacation-user', yearmonthday: '20251209' },
    });

    expect(currentMonthUser).not.toBeNull();
    expect(vacationLog).not.toBeNull();
    expect(interaction.getLastReply()).toContain('휴가를 등록');
  });

  it('TC-WM03: 중단한 사용자는 다음 달 리포트에서 자동 등록되지 않는다', async () => {
    await TestWakeUpMembership.create({
      userid: 'stopped-user',
      username: '박민수',
      waketime: '0700',
      status: 'active',
      stoppedat: null,
    });
    await TestUsers.create({
      userid: 'stopped-user',
      username: '박민수',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    vi.setSystemTime(new Date('2025-12-20T07:05:00Z'));
    const stopInteraction = createMockInteraction({
      userId: 'stopped-user',
      globalName: '박민수',
    });

    const { command: stopCommand } = await import('../commands/haruharu/stop-wakeup.js');
    await stopCommand.execute(stopInteraction as never);

    vi.setSystemTime(new Date('2026-01-08T07:05:00Z'));
    const { buildChallengeReport } = await import('../services/reporting.js');
    const { attendanceMessage } = await buildChallengeReport();

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'stopped-user' } });
    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'stopped-user', yearmonth: '202601' },
    });

    expect(membership?.status).toBe('stopped');
    expect(currentMonthUser).toBeNull();
    expect(attendanceMessage).not.toContain('박민수');
    expect(stopInteraction.getLastReply()).toContain('중단');
  });

  it('TC-WM04: 중단 후 다시 register 하면 membership이 재활성화되고 현재 월 스냅샷이 생성된다', async () => {
    await TestWakeUpMembership.create({
      userid: 'return-user',
      username: '최민지',
      waketime: '0700',
      status: 'stopped',
      stoppedat: '2025-12-20T00:00:00.000Z',
    });

    const interaction = createMockInteraction({
      userId: 'return-user',
      globalName: '최민지',
      options: {
        waketime: '0800',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'return-user' } });
    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'return-user', yearmonth: '202601' },
    });

    expect(membership?.status).toBe('active');
    expect(membership?.waketime).toBe('0800');
    expect(currentMonthUser?.waketime).toBe('0800');
    expect(interaction.getLastReply()).toContain('등록했습니다');
  });

  it('TC-WM05: 신규 /register 후 다음 달에도 자동 이월된다', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:05:00Z'));
    const registerInteraction = createMockInteraction({
      userId: 'new-user',
      globalName: '오하늘',
      options: {
        waketime: '0715',
      },
    });
    const { command: registerCommand } = await import('../commands/haruharu/register.js');
    await registerCommand.execute(registerInteraction as never);

    vi.setSystemTime(new Date('2026-01-08T07:05:00Z'));
    const { buildChallengeReport } = await import('../services/reporting.js');
    await buildChallengeReport();

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'new-user' } });
    const previousMonthUser = await TestUsers.findOne({ where: { userid: 'new-user', yearmonth: '202512' } });
    const currentMonthUser = await TestUsers.findOne({ where: { userid: 'new-user', yearmonth: '202601' } });

    expect(membership?.status).toBe('active');
    expect(membership?.waketime).toBe('0715');
    expect(previousMonthUser?.waketime).toBe('0715');
    expect(currentMonthUser?.waketime).toBe('0715');
    expect(registerInteraction.getLastReply()).toContain('등록했습니다');
  });

  it('TC-WM06: 같은 userid/yearmonth Users 스냅샷은 중복 저장되지 않는다', async () => {
    await TestUsers.create({
      userid: 'unique-user',
      username: '유일사용자',
      yearmonth: '202601',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await expect(
      TestUsers.create({
        userid: 'unique-user',
        username: '유일사용자',
        yearmonth: '202601',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 0,
      }),
    ).rejects.toThrow();
  });

  it('TC-WM07: /delete로 제거된 월 스냅샷은 리포트 자동 생성으로 되살아나지 않는다', async () => {
    await TestWakeUpMembership.create({
      userid: 'deleted-user',
      username: '삭제대상',
      waketime: '0700',
      status: 'active',
      stoppedat: null,
    });
    await TestUsers.create({
      userid: 'deleted-user',
      username: '삭제대상',
      yearmonth: '202601',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const deleteInteraction = createMockInteraction({
      options: {
        userid: 'deleted-user',
        yearmonth: '202601',
      },
    });

    const { command: deleteCommand } = await import('../commands/haruharu/delete.js');
    await deleteCommand.execute(deleteInteraction as never);

    const { buildChallengeReport } = await import('../services/reporting.js');
    const { attendanceMessage } = await buildChallengeReport();

    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'deleted-user', yearmonth: '202601' },
    });

    expect(deleteInteraction.getLastReply()).toContain('삭제했습니다');
    expect(currentMonthUser).toBeNull();
    expect(attendanceMessage).not.toContain('삭제대상');
  });

  it('TC-WM08: membership이 없는 기존 Users 참가자도 다음 달 자동 이월 대상에 포함된다', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:05:00Z'));
    await TestUsers.create({
      userid: 'legacy-user',
      username: '기존참가자',
      yearmonth: '202512',
      waketime: '0645',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    vi.setSystemTime(new Date('2026-01-08T07:05:00Z'));
    const { buildChallengeReport } = await import('../services/reporting.js');
    const { attendanceMessage } = await buildChallengeReport();

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'legacy-user' } });
    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'legacy-user', yearmonth: '202601' },
    });

    expect(membership?.status).toBe('active');
    expect(membership?.waketime).toBe('0645');
    expect(currentMonthUser?.waketime).toBe('0645');
    expect(attendanceMessage).toContain('기존참가자: 결석');
  });

  it('TC-WM09: legacy Users만 있는 참가자도 첫 리포트 전 /stop-wakeup 으로 중단할 수 있다', async () => {
    vi.setSystemTime(new Date('2025-12-20T07:05:00Z'));
    await TestUsers.create({
      userid: 'legacy-stop-user',
      username: '중단대상',
      yearmonth: '202512',
      waketime: '0710',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    vi.setSystemTime(new Date('2026-01-08T07:05:00Z'));
    const stopInteraction = createMockInteraction({
      userId: 'legacy-stop-user',
      globalName: '중단대상',
    });

    const { command: stopCommand } = await import('../commands/haruharu/stop-wakeup.js');
    await stopCommand.execute(stopInteraction as never);

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'legacy-stop-user' } });

    expect(membership?.status).toBe('stopped');
    expect(membership?.waketime).toBe('0710');
    expect(stopInteraction.getLastReply()).toContain('중단했습니다');
  });

  it('TC-WM10: legacy Users backfill 경로는 동시 /stop-wakeup 요청에도 unique 충돌 없이 idempotent 하다', async () => {
    vi.setSystemTime(new Date('2025-12-20T07:05:00Z'));
    await TestUsers.create({
      userid: 'legacy-concurrent-user',
      username: '동시중단',
      yearmonth: '202512',
      waketime: '0715',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    vi.setSystemTime(new Date('2026-01-08T07:05:00Z'));
    const { executeStopWakeUp } = await import('../services/challengeSelfService.js');

    await expect(
      Promise.all([
        executeStopWakeUp({ userId: 'legacy-concurrent-user' }),
        executeStopWakeUp({ userId: 'legacy-concurrent-user' }),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ reply: expect.stringContaining('중단') }),
      expect.objectContaining({ reply: expect.any(String) }),
    ]);

    const memberships = await TestWakeUpMembership.findAll({
      where: { userid: 'legacy-concurrent-user' },
    });

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.status).toBe('stopped');
  });
});
