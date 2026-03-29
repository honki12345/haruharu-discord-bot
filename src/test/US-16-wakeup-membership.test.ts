import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TestUsers,
  TestVacationLog,
  TestWakeUpMembership,
  clearAllTables,
  createMockInteraction,
  testSequelize,
} from './test-setup.js';

type ProgramType = 'wake-up' | 'cam-study';
type ApplicationStatus = 'pending' | 'approved' | 'rejected';

interface ParticipationApplicationRecord {
  userid: string;
  username: string;
  program: ProgramType;
  status: ApplicationStatus;
  reason: string | null;
}

const applications = new Map<string, ParticipationApplicationRecord>();
const getApplicationKey = (userid: string, program: ProgramType) => `${userid}:${program}`;

vi.mock('../repository/ParticipationApplication.js', () => ({
  ParticipationApplication: {
    findOne: vi.fn(async ({ where }: { where: { userid: string; program: ProgramType } }) => {
      return applications.get(getApplicationKey(where.userid, where.program)) ?? null;
    }),
    create: vi.fn(async (record: ParticipationApplicationRecord) => {
      applications.set(getApplicationKey(record.userid, record.program), record);
      return record;
    }),
    update: vi.fn(
      async (
        values: Partial<ParticipationApplicationRecord>,
        { where }: { where: { userid: string; program: ProgramType } },
      ) => {
        const current = applications.get(getApplicationKey(where.userid, where.program));
        if (!current) {
          return [0];
        }

        applications.set(getApplicationKey(where.userid, where.program), {
          ...current,
          ...values,
        });
        return [1];
      },
    ),
  },
}));

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
    applications.clear();
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

  it('TC-WM02: 활성 사용자는 다음 달 휴가 신청 시 현재 월 스냅샷이 없어도 자동으로 생성된다', async () => {
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
        date: '20260109',
      },
    });

    const { command } = await import('../commands/haruharu/apply-vacation.js');
    await command.execute(interaction as never);

    const currentMonthUser = await TestUsers.findOne({
      where: { userid: 'vacation-user', yearmonth: '202601' },
    });
    const vacationLog = await TestVacationLog.findOne({
      where: { userid: 'vacation-user', yearmonthday: '20260109' },
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

  it('TC-WM05: /apply-wakeup 즉시 활성화 후 /register 를 거치면 다음 달에도 자동 이월된다', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:05:00Z'));
    const applyInteraction = createMockInteraction({
      userId: 'apply-user',
      globalName: '오하늘',
      channelId: 'valid-apply-channel-id',
    });

    const { command: applyCommand } = await import('../commands/haruharu/apply-wakeup.js');
    await applyCommand.execute(applyInteraction as never);

    const registerInteraction = createMockInteraction({
      userId: 'apply-user',
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

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'apply-user' } });
    const previousMonthUser = await TestUsers.findOne({ where: { userid: 'apply-user', yearmonth: '202512' } });
    const currentMonthUser = await TestUsers.findOne({ where: { userid: 'apply-user', yearmonth: '202601' } });

    expect(membership?.status).toBe('active');
    expect(membership?.waketime).toBe('0715');
    expect(previousMonthUser?.waketime).toBe('0715');
    expect(currentMonthUser?.waketime).toBe('0715');
    expect(applyInteraction.getLastReply()).toContain('기상인증 참여가 활성화');
    expect(registerInteraction.getLastReply()).toContain('등록했습니다');
  });
});
