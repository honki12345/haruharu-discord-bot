/**
 * US-05: 일일 출석 리포트
 * 시스템은 매일 13:00에 AttendanceLog 기준 당일 출석 현황을 채널에 발송한다.
 *
 * US-06: 월말 명예의 전당
 * 시스템은 월말에 absencecount <= vacances 기준 챌린지 완주자 명단을 발송한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestAttendanceLog, TestUsers, clearAllTables } from './test-setup.js';
import { buildChallengeReport } from '../services/reporting.js';

// 파일 레벨에서 한 번만 설정
beforeAll(async () => {
  await testSequelize.sync({ force: true });
});

afterAll(async () => {
  await testSequelize.close();
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-12-08T13:00:00'));
  await clearAllTables();
});

afterEach(() => {
  vi.useRealTimers();
});

const expectMonthlyStatus = (
  attendanceMessage: string | null,
  expectation: {
    username: string;
    waketime: string;
    todayStatus: '출석' | '지각' | '결석' | '휴가';
    latecount: number;
    absencecount: number;
    remainingVacances: number;
  },
) => {
  expect(attendanceMessage).toContain(
    `${expectation.username}: ${expectation.todayStatus} (기상시간 ${expectation.waketime}, 지각 ${expectation.latecount}회, 결석 ${expectation.absencecount}회, 잔여휴가 ${expectation.remainingVacances}일)`,
  );
};

describe('US-05: 일일 출석 리포트', () => {
  describe('TC-DR01: 출석자 분류', () => {
    it('AttendanceLog.status=attended 사용자는 출석으로 분류된다', async () => {
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
      const updated = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

      expect(attendanceMessage).toContain('### 2025-12-08 출석표');
      expectMonthlyStatus(attendanceMessage, {
        username: '홍길동',
        waketime: '07:00',
        todayStatus: '출석',
        latecount: 0,
        absencecount: 0,
        remainingVacances: 5,
      });
      expect(updated?.latecount).toBe(0);
      expect(updated?.absencecount).toBe(0);
    });
  });

  describe('TC-DR02: 지각자 분류', () => {
    it('AttendanceLog.status=late 사용자는 지각으로 분류된다', async () => {
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
        commentedat: '2025-12-07T22:12:00Z',
        status: 'late',
      });

      const { attendanceMessage } = await buildChallengeReport();
      const updated = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

      expectMonthlyStatus(attendanceMessage, {
        username: '홍길동',
        waketime: '07:00',
        todayStatus: '지각',
        latecount: 1,
        absencecount: 0,
        remainingVacances: 5,
      });
      expect(updated?.latecount).toBe(1);
    });
  });

  describe('TC-DR03: 결석자 분류', () => {
    it('댓글이 없는 사용자는 결석으로 분류된다', async () => {
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
      const updated = await TestUsers.findOne({ where: { userid: 'user1', yearmonth: '202512' } });

      expectMonthlyStatus(attendanceMessage, {
        username: '홍길동',
        waketime: '07:00',
        todayStatus: '결석',
        latecount: 0,
        absencecount: 1,
        remainingVacances: 5,
      });
      expect(updated?.absencecount).toBe(1);
    });
  });

  describe('TC-DR04: 결석 카운트 증가', () => {
    it('AttendanceLog.status=absent면 absencecount가 1 증가한다', async () => {
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
        commentedat: '2025-12-07T22:31:00Z',
        status: 'absent',
      });

      await buildChallengeReport();

      const updated = await TestUsers.findOne({ where: { userid: 'user1' } });
      expect(updated?.absencecount).toBe(1);
    });
  });

  describe('TC-DR05: 지각 카운트 증가', () => {
    it('AttendanceLog.status=late면 latecount가 1 증가한다', async () => {
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
        commentedat: '2025-12-07T22:12:00Z',
        status: 'late',
      });

      await buildChallengeReport();

      const updated = await TestUsers.findOne({ where: { userid: 'user1' } });
      expect(updated?.latecount).toBe(1);
    });
  });
});

describe('US-06: 월말 명예의 전당', () => {
  describe('TC-HF01: 챌린지 완주자 조회', () => {
    it('absencecount가 vacances 이하인 사용자가 완주자로 선정된다', async () => {
      await TestUsers.bulkCreate([
        {
          userid: 'user1',
          username: '완주자1',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 2,
          absencecount: 3, // 5 이하 - 완주
        },
        {
          userid: 'user2',
          username: '완주자2',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0, // 5 이하 - 완주
        },
        {
          userid: 'user3',
          username: '탈락자',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 6, // 5 초과 - 탈락
        },
      ]);

      const allUsers = await TestUsers.findAll({ where: { yearmonth: '202512' } });
      const survivors = allUsers.filter(user => user.absencecount <= user.vacances);

      expect(survivors.length).toBe(2);
      expect(survivors.map(u => u.username)).toContain('완주자1');
      expect(survivors.map(u => u.username)).toContain('완주자2');
      expect(survivors.map(u => u.username)).not.toContain('탈락자');
    });
  });

  describe('TC-HF02: 휴가를 추가로 받은 사용자', () => {
    it('휴가가 추가된 사용자는 더 많은 결석이 허용된다', async () => {
      await TestUsers.bulkCreate([
        {
          userid: 'user1',
          username: '기본휴가',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 6, // 기본 5일 초과 - 탈락
        },
        {
          userid: 'user2',
          username: '추가휴가',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 7, // 휴가 추가됨
          latecount: 0,
          absencecount: 6, // 7일 이하 - 완주
        },
      ]);

      const allUsers = await TestUsers.findAll({ where: { yearmonth: '202512' } });
      const survivors = allUsers.filter(user => user.absencecount <= user.vacances);

      expect(survivors.length).toBe(1);
      expect(survivors[0].username).toBe('추가휴가');
    });
  });

  describe('TC-HF03: 경계값 테스트', () => {
    it('absencecount가 정확히 vacances와 같으면 완주이다', async () => {
      await TestUsers.create({
        userid: 'user1',
        username: '경계완주자',
        yearmonth: '202512',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 5, // 정확히 5 = 완주
      });

      const allUsers = await TestUsers.findAll({ where: { yearmonth: '202512' } });
      const survivors = allUsers.filter(user => user.absencecount <= user.vacances);

      expect(survivors.length).toBe(1);
    });

    it('absencecount가 vacances + 1이면 탈락이다', async () => {
      await TestUsers.create({
        userid: 'user1',
        username: '탈락자',
        yearmonth: '202512',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 6, // 6 > 5 = 탈락
      });

      const allUsers = await TestUsers.findAll({ where: { yearmonth: '202512' } });
      const survivors = allUsers.filter(user => user.absencecount <= user.vacances);

      expect(survivors.length).toBe(0);
    });
  });
});
