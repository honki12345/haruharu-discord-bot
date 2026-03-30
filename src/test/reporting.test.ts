import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './test-setup.js';
import { logger } from '../logger.js';
import { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';
import { ONE_DAY_MILLISECONDS } from '../utils.js';
import {
  TestAttendanceLog,
  TestCamStudyActiveSession,
  TestCamStudyTimeLog,
  TestCamStudyUsers,
  TestCamStudyWeeklyTimeLog,
  TestTimeLog,
  TestUsers,
  TestVacationLog,
  TestWaketimeChangeLog,
  clearAllTables,
  testSequelize,
} from './test-setup.js';

describe('reporting service', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await testSequelize.sync({ force: true });
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const expectMonthlyStatus = (
    attendanceMessage: string | null,
    expectation: {
      username: string;
      todayStatus: '출석' | '지각' | '결석' | '휴가';
      latecount: number;
      absencecount: number;
      remainingVacances: number;
    },
  ) => {
    expect(attendanceMessage).toContain(
      `${expectation.username}: ${expectation.todayStatus} (지각 ${expectation.latecount}회, 결석 ${expectation.absencecount}회, 잔여휴가 ${expectation.remainingVacances}일)`,
    );
  };

  it('AttendanceLog.status=attended 사용자는 출석으로 출력되고 카운트가 증가하지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251208',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-07T22:00:00Z',
      status: 'attended',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.latecount).toBe(0);
    expect(updatedUser?.absencecount).toBe(0);
    expect(attendanceMessage).toContain('### 2025-12-08 출석표');
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '출석',
      latecount: 0,
      absencecount: 0,
      remainingVacances: 5,
    });
  });

  it('AttendanceLog 요약 로그는 상태만 남기고 thread/message 식별자는 남기지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251208',
      threadid: 'thread-sensitive',
      messageid: 'message-sensitive',
      commentedat: '2025-12-07T22:00:00Z',
      status: 'attended',
    });

    await buildChallengeReport();

    expect(logger.info).toHaveBeenCalledWith('user id 로 그룹핑한 attendanceLog 인스턴스들 요약: ', {
      totalUsers: 1,
      attendanceSummary: [{ userid: 'user1', status: 'attended' }],
    });
  });

  it('AttendanceLog가 없고 TimeLog만 있는 사용자는 fallback 없이 결석으로 집계된다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestTimeLog.bulkCreate([
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251208',
        checkintime: '0700',
        checkouttime: null,
        isintime: true,
      },
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251208',
        checkintime: null,
        checkouttime: '0800',
        isintime: true,
      },
    ]);

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.latecount).toBe(0);
    expect(updatedUser?.absencecount).toBe(1);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '결석',
      latecount: 0,
      absencecount: 1,
      remainingVacances: 5,
    });
  });

  it('AttendanceLog.status=late 사용자는 지각으로 출력되고 latecount가 1 증가한다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: null as never,
      absencecount: 0,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251208',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-07T22:11:00Z',
      status: 'late',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.latecount).toBe(1);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '지각',
      latecount: 1,
      absencecount: 0,
      remainingVacances: 5,
    });
    expect(attendanceMessage).not.toContain('NaN');
  });

  it('AttendanceLog가 없고 TimeLog가 지각 기록이어도 fallback 없이 결석으로 집계된다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestTimeLog.bulkCreate([
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251208',
        checkintime: '0711',
        checkouttime: null,
        isintime: false,
      },
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251208',
        checkintime: null,
        checkouttime: '0800',
        isintime: true,
      },
    ]);

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.latecount).toBe(0);
    expect(updatedUser?.absencecount).toBe(1);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '결석',
      latecount: 0,
      absencecount: 1,
      remainingVacances: 5,
    });
  });

  it('AttendanceLog.status=absent 사용자는 결석으로 출력되고 absencecount가 1 증가한다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: null as never,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251208',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-07T22:31:00Z',
      status: 'absent',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.absencecount).toBe(1);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '결석',
      latecount: 0,
      absencecount: 1,
      remainingVacances: 5,
    });
    expect(attendanceMessage).not.toContain('NaN');
  });

  it('당일 무댓글 사용자도 결석으로 확정되어 결과표와 absencecount에 반영된다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.absencecount).toBe(1);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '결석',
      latecount: 0,
      absencecount: 1,
      remainingVacances: 5,
    });
  });

  it('월말 생존명단은 당일 AttendanceLog 기반 결석 집계 반영 후 생성한다', async () => {
    vi.setSystemTime(new Date('2026-12-31T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202612',
      waketime: '0700',
      vacances: 0,
      latecount: 0,
      absencecount: 0,
    });

    const { attendanceMessage, hallOfFameMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202612' } });

    expect(updatedUser?.absencecount).toBe(1);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '결석',
      latecount: 0,
      absencecount: 1,
      remainingVacances: 0,
    });
    expect(hallOfFameMessage).not.toContain('홍길동');
  });

  it('휴가 등록된 날짜는 결석으로 카운트하지 않고 휴가로 표시한다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestVacationLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251208',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.absencecount).toBe(0);
    expectMonthlyStatus(attendanceMessage, {
      username: '홍길동',
      todayStatus: '휴가',
      latecount: 0,
      absencecount: 0,
      remainingVacances: 4,
    });
  });

  it('결과표가 Discord 2000자 제한을 넘기면 여러 메시지로 분할한다', async () => {
    vi.setSystemTime(new Date('2025-12-08T13:00:00'));

    for (let index = 0; index < 40; index += 1) {
      const userid = `user-${index}`;
      const username = `출석자-${String(index).padStart(2, '0')}-이름이조금긴테스트사용자`;

      await TestUsers.create({
        userid,
        username,
        yearmonth: '202512',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 0,
      });

      await TestAttendanceLog.create({
        userid,
        username,
        yearmonthday: '20251208',
        threadid: `thread-${index}`,
        messageid: `message-${index}`,
        commentedat: '2025-12-07T22:00:00Z',
        status: 'attended',
      });
    }

    const { attendanceMessage, attendanceMessages } = await buildChallengeReport();

    expect(attendanceMessages).not.toBeNull();
    expect(attendanceMessages!.length).toBeGreaterThan(1);
    expect(attendanceMessages!.every(message => message.length <= 2000)).toBe(true);
    expect(attendanceMessages!.join('')).toBe(attendanceMessage);
  });

  it('주말에는 출석 집계를 건너뛰고 카운트를 변경하지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-07T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 1,
      absencecount: 2,
    });

    const { attendanceMessage, hallOfFameMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(attendanceMessage).toBeNull();
    expect(hallOfFameMessage).toBeNull();
    expect(updatedUser?.latecount).toBe(1);
    expect(updatedUser?.absencecount).toBe(2);
  });

  it('주말 attended 로그는 absencecount를 우선 차감한다', async () => {
    vi.setSystemTime(new Date('2025-12-07T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 1,
      absencecount: 2,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251207',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-06T22:00:00Z',
      status: 'attended',
    });

    const { attendanceMessage, hallOfFameMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(attendanceMessage).toBeNull();
    expect(hallOfFameMessage).toBeNull();
    expect(updatedUser?.latecount).toBe(1);
    expect(updatedUser?.absencecount).toBe(1);
  });

  it('주말 attended 로그는 absencecount가 없으면 latecount를 차감한다', async () => {
    vi.setSystemTime(new Date('2025-12-07T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 2,
      absencecount: 0,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251207',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-06T22:00:00Z',
      status: 'attended',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(attendanceMessage).toBeNull();
    expect(updatedUser?.latecount).toBe(1);
    expect(updatedUser?.absencecount).toBe(0);
  });

  it('주말 late 로그는 패널티를 추가하지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-07T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 1,
      absencecount: 2,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251207',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-06T22:15:00Z',
      status: 'late',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(attendanceMessage).toBeNull();
    expect(updatedUser?.latecount).toBe(1);
    expect(updatedUser?.absencecount).toBe(2);
  });

  it('공휴일 attended 로그는 주말과 같은 보너스 규칙을 적용한다', async () => {
    vi.setSystemTime(new Date('2026-01-01T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202601',
      waketime: '0700',
      vacances: 5,
      latecount: 1,
      absencecount: 2,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20260101',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-31T22:00:00Z',
      status: 'attended',
    });

    const { attendanceMessage, hallOfFameMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202601' } });

    expect(attendanceMessage).toBeNull();
    expect(hallOfFameMessage).toBeNull();
    expect(updatedUser?.latecount).toBe(1);
    expect(updatedUser?.absencecount).toBe(1);
  });

  it('공휴일 absent 로그도 패널티를 추가하지 않는다', async () => {
    vi.setSystemTime(new Date('2026-01-01T13:00:00'));

    await TestUsers.create({
      userid: 'user1',
      username: '홍길동',
      yearmonth: '202601',
      waketime: '0700',
      vacances: 5,
      latecount: 1,
      absencecount: 2,
    });

    await TestAttendanceLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20260101',
      threadid: 'thread-1',
      messageid: 'message-1',
      commentedat: '2025-12-31T22:31:00Z',
      status: 'absent',
    });

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202601' } });

    expect(attendanceMessage).toBeNull();
    expect(updatedUser?.latecount).toBe(1);
    expect(updatedUser?.absencecount).toBe(2);
  });

  it('스케줄 리포트 실행이 실패해도 에러를 로깅하고 다음 실행으로 죽지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-08T12:59:00'));

    const challengeReport = vi.fn().mockRejectedValue(new Error('boom'));
    const camStudyReport = vi.fn().mockResolvedValue(undefined);

    scheduleDailyReports(challengeReport, camStudyReport);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(challengeReport).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Error while running scheduled challenge report', expect.any(Object));
  });

  it('이전 실행이 끝나지 않았으면 다음 challenge 리포트 실행을 건너뛴다', async () => {
    vi.setSystemTime(new Date('2025-12-08T12:59:00'));

    const pendingPromise = new Promise<void>(() => undefined);
    const challengeReport = vi.fn().mockReturnValue(pendingPromise);
    const camStudyReport = vi.fn().mockResolvedValue(undefined);

    scheduleDailyReports(challengeReport, camStudyReport);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(ONE_DAY_MILLISECONDS);

    expect(challengeReport).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Skipping challenge report run because previous run is still in progress');
  });

  it('캠스터디 리포트는 진행 중 active session 을 집계에서 제외하고 로그로 남긴다', async () => {
    vi.setSystemTime(new Date('2025-12-07T23:59:00'));

    await TestCamStudyUsers.create({
      userid: 'user1',
      username: '홍길동',
    });
    await TestCamStudyTimeLog.create({
      userid: 'user1',
      username: '홍길동',
      yearmonthday: '20251207',
      timestamp: new Date('2025-12-07T20:00:00').getTime().toString(),
      totalminutes: 60,
    });
    await TestCamStudyActiveSession.create({
      userid: 'user1',
      username: '홍길동',
      channelid: 'valid-voice-channel-id',
      startedat: new Date('2025-12-07T23:00:00').getTime().toString(),
      lastobservedat: new Date('2025-12-07T23:58:00').getTime().toString(),
    });

    const { dailyMessage } = await buildCamStudyReports();

    expect(dailyMessage).toContain('홍길동님의 공부시간: 1시간 0분');
    expect(logger.info).toHaveBeenCalledWith('Skipping active cam study sessions from report totals', {
      activeSessionUserIds: ['user1'],
    });
  });

  it('syncModels는 self-service 와 active session 관련 모델도 함께 동기화한다', async () => {
    const attendanceLogSyncSpy = vi.spyOn(TestAttendanceLog, 'sync').mockResolvedValue(TestAttendanceLog);
    const camStudyActiveSessionSyncSpy = vi
      .spyOn(TestCamStudyActiveSession, 'sync')
      .mockResolvedValue(TestCamStudyActiveSession);
    const vacationLogSyncSpy = vi.spyOn(TestVacationLog, 'sync').mockResolvedValue(TestVacationLog);
    const waketimeChangeLogSyncSpy = vi.spyOn(TestWaketimeChangeLog, 'sync').mockResolvedValue(TestWaketimeChangeLog);

    await syncModels();

    expect(attendanceLogSyncSpy).toHaveBeenCalledTimes(1);
    expect(camStudyActiveSessionSyncSpy).toHaveBeenCalledTimes(1);
    expect(vacationLogSyncSpy).toHaveBeenCalledTimes(1);
    expect(waketimeChangeLogSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('캠스터디 주간 집계를 같은 날 두 번 실행해도 중복 누적하지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-10T23:59:00'));

    await TestCamStudyUsers.create({
      userid: 'user1',
      username: '홍길동',
    });

    await TestCamStudyTimeLog.bulkCreate([
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251208',
        timestamp: Date.now().toString(),
        totalminutes: 60,
      },
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251210',
        timestamp: Date.now().toString(),
        totalminutes: 30,
      },
    ]);

    await buildCamStudyReports();
    await buildCamStudyReports();

    const weeklyLogs = await TestCamStudyWeeklyTimeLog.findAll();
    expect(weeklyLogs).toHaveLength(1);
    expect(weeklyLogs[0]?.totalminutes).toBe(90);
  });

  it('캠스터디 주간 집계는 이전 주 금요일 로그를 포함하지 않는다', async () => {
    vi.setSystemTime(new Date('2025-12-10T23:59:00'));

    await TestCamStudyUsers.create({
      userid: 'user1',
      username: '홍길동',
    });

    await TestCamStudyTimeLog.bulkCreate([
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251205',
        timestamp: Date.now().toString(),
        totalminutes: 120,
      },
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251206',
        timestamp: Date.now().toString(),
        totalminutes: 60,
      },
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251210',
        timestamp: Date.now().toString(),
        totalminutes: 30,
      },
    ]);

    await buildCamStudyReports();

    const weeklyLogs = await TestCamStudyWeeklyTimeLog.findAll();
    expect(weeklyLogs).toHaveLength(1);
    expect(weeklyLogs[0]?.totalminutes).toBe(90);
  });
});
