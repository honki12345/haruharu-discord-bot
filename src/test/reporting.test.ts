import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './test-setup.js';
import { logger } from '../logger.js';
import { buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';
import { ONE_DAY_MILLISECONDS } from '../utils.js';
import { TestAttendanceLog, TestUsers, clearAllTables, testSequelize } from './test-setup.js';

describe('reporting service', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await testSequelize.sync({ force: true });
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(attendanceMessage).toContain('홍길동: 출석');
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
    expect(attendanceMessage).toContain('지각 (1)');
    expect(attendanceMessage).not.toContain('NaN');
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
    expect(attendanceMessage).toContain('결석 (1/5)');
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
    expect(attendanceMessage).toContain('홍길동: 결석 (1/5)');
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
    expect(attendanceMessage).toContain('결석 (1/0)');
    expect(hallOfFameMessage).not.toContain('홍길동');
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

  it('공휴일에는 출석 집계를 건너뛰고 카운트를 변경하지 않는다', async () => {
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

    const { attendanceMessage, hallOfFameMessage } = await buildChallengeReport();
    const updatedUser = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202601' } });

    expect(attendanceMessage).toBeNull();
    expect(hallOfFameMessage).toBeNull();
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

  it('syncModels는 AttendanceLog 모델도 함께 동기화한다', async () => {
    const attendanceLogSyncSpy = vi.spyOn(TestAttendanceLog, 'sync').mockResolvedValue(TestAttendanceLog);

    await syncModels();

    expect(attendanceLogSyncSpy).toHaveBeenCalledTimes(1);
  });
});
