import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './test-setup.js';
import { logger } from '../logger.js';
import { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';
import { ONE_DAY_MILLISECONDS } from '../utils.js';
import {
  TestAttendanceLog,
  TestCamStudyTimeLog,
  TestCamStudyUsers,
  TestCamStudyWeeklyTimeLog,
  TestTimeLog,
  TestUsers,
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
  });

  it('결석 카운트가 null이어도 1부터 안전하게 증가한다', async () => {
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

    const { attendanceMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

    expect(updatedUser?.absencecount).toBe(1);
    expect(attendanceMessage).toContain('결석 (1/5)');
    expect(attendanceMessage).not.toContain('NaN');
  });

  it('지각 카운트가 null이어도 1부터 안전하게 증가한다', async () => {
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

    await TestTimeLog.bulkCreate([
      {
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251208',
        checkintime: '0700',
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

    expect(updatedUser?.latecount).toBe(1);
    expect(attendanceMessage).toContain('지각 (1)');
    expect(attendanceMessage).not.toContain('NaN');
  });

  it('월말 생존명단은 당일 출석 집계 반영 후 생성한다', async () => {
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
    expect(attendanceMessage).toContain('결석 (1/0)');
    expect(hallOfFameMessage).not.toContain('홍길동');
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

  it('syncModels는 AttendanceLog 모델도 함께 동기화한다', async () => {
    const attendanceLogSyncSpy = vi.spyOn(TestAttendanceLog, 'sync').mockResolvedValue(TestAttendanceLog);

    await syncModels();

    expect(attendanceLogSyncSpy).toHaveBeenCalledTimes(1);
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
});
