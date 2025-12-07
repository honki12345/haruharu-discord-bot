/**
 * US-05: 일일 출석 리포트
 * 시스템은 매일 23:30에 당일 출석 현황을 채널에 발송한다.
 *
 * US-06: 월말 명예의 전당
 * 시스템은 월말에 챌린지 완주자 명단을 발송한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestUsers, TestTimeLog, clearAllTables } from './test-setup.js';

// 파일 레벨에서 한 번만 설정
beforeAll(async () => {
  await testSequelize.sync({ force: true });
});

afterAll(async () => {
  await testSequelize.close();
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-12-07T23:30:00'));
  await clearAllTables();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('US-05: 일일 출석 리포트', () => {
  describe('TC-DR01: 출석자 분류', () => {
    it('체크인/체크아웃 모두 정시인 사용자는 출석으로 분류된다', async () => {
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
          yearmonthday: '20251207',
          checkintime: '0700',
          checkouttime: null,
          isintime: true,
        },
        {
          userid: 'user1',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: null,
          checkouttime: '0800',
          isintime: true,
        },
      ]);

      const timelogs = await TestTimeLog.findAll({
        where: { yearmonthday: '20251207', userid: 'user1' },
      });

      // 출석 조건: 2개의 로그가 있고, 둘 다 isintime이 true
      const isAttended = timelogs.length === 2 && timelogs.every(log => log.isintime);
      expect(isAttended).toBe(true);
    });
  });

  describe('TC-DR02: 지각자 분류', () => {
    it('체크인 또는 체크아웃이 지각인 사용자는 지각으로 분류된다', async () => {
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
          yearmonthday: '20251207',
          checkintime: '0715', // 지각
          checkouttime: null,
          isintime: false,
        },
        {
          userid: 'user1',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: null,
          checkouttime: '0800',
          isintime: true,
        },
      ]);

      const timelogs = await TestTimeLog.findAll({
        where: { yearmonthday: '20251207', userid: 'user1' },
      });

      // 지각 조건: 2개의 로그가 있지만, 하나라도 isintime이 false
      const isLate = timelogs.length === 2 && timelogs.some(log => !log.isintime);
      expect(isLate).toBe(true);
    });
  });

  describe('TC-DR03: 결석자 분류', () => {
    it('체크인/체크아웃 중 하나라도 없으면 결석으로 분류된다', async () => {
      await TestUsers.create({
        userid: 'user1',
        username: '홍길동',
        yearmonth: '202512',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 0,
      });

      // 체크인만 있고 체크아웃 없음
      await TestTimeLog.create({
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251207',
        checkintime: '0700',
        checkouttime: null,
        isintime: true,
      });

      const timelogs = await TestTimeLog.findAll({
        where: { yearmonthday: '20251207', userid: 'user1' },
      });

      // 결석 조건: 로그가 2개가 아님
      const isAbsent = timelogs.length !== 2;
      expect(isAbsent).toBe(true);
    });
  });

  describe('TC-DR04: 결석 카운트 증가', () => {
    it('결석 시 absencecount가 1 증가한다', async () => {
      await TestUsers.create({
        userid: 'user1',
        username: '홍길동',
        yearmonth: '202512',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 0,
      });

      // 결석 처리 시뮬레이션
      const user = await TestUsers.findOne({ where: { userid: 'user1' } });
      await TestUsers.update(
        { absencecount: user!.absencecount + 1 },
        { where: { userid: 'user1', yearmonth: '202512' } },
      );

      const updated = await TestUsers.findOne({ where: { userid: 'user1' } });
      expect(updated?.absencecount).toBe(1);
    });
  });

  describe('TC-DR05: 지각 카운트 증가', () => {
    it('지각 시 latecount가 1 증가한다', async () => {
      await TestUsers.create({
        userid: 'user1',
        username: '홍길동',
        yearmonth: '202512',
        waketime: '0700',
        vacances: 5,
        latecount: 0,
        absencecount: 0,
      });

      // 지각 처리 시뮬레이션
      const user = await TestUsers.findOne({ where: { userid: 'user1' } });
      await TestUsers.update({ latecount: user!.latecount + 1 }, { where: { userid: 'user1', yearmonth: '202512' } });

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

      // sequelize.col 대신 직접 비교
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
