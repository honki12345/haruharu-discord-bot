/**
 * US-09: 일간 캠스터디 리포트
 * 시스템은 매일 자정에 당일 공부 시간을 채널에 발송한다.
 *
 * US-10: 주간 캠스터디 리포트
 * 시스템은 매일 자정에 주간 누적 공부 시간을 채널에 발송한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  testSequelize,
  TestCamStudyUsers,
  TestCamStudyTimeLog,
  TestCamStudyWeeklyTimeLog,
  clearAllTables,
} from './test-setup.js';
import { calculateWeekTimes, formatFromMinutesToHours } from '../utils.js';

// 파일 레벨에서 한 번만 설정
beforeAll(async () => {
  await testSequelize.sync({ force: true });
});

afterAll(async () => {
  await testSequelize.close();
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-12-07T00:00:00'));
  await clearAllTables();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('US-09: 일간 캠스터디 리포트', () => {

  describe('TC-CDR01: 일간 공부시간 조회', () => {
    it('특정 날짜의 모든 사용자 공부시간을 조회할 수 있다', async () => {
      await TestCamStudyUsers.bulkCreate([
        { userid: 'user1', username: '홍길동' },
        { userid: 'user2', username: '김철수' },
        { userid: 'user3', username: '이영희' },
      ]);

      await TestCamStudyTimeLog.bulkCreate([
        {
          userid: 'user1',
          username: '홍길동',
          yearmonthday: '20251207',
          timestamp: Date.now().toString(),
          totalminutes: 180, // 3시간
        },
        {
          userid: 'user2',
          username: '김철수',
          yearmonthday: '20251207',
          timestamp: Date.now().toString(),
          totalminutes: 240, // 4시간
        },
        // user3은 오늘 공부 안함
      ]);

      const timelogs = await TestCamStudyTimeLog.findAll({
        where: { yearmonthday: '20251207' },
      });

      expect(timelogs.length).toBe(2);
    });
  });

  describe('TC-CDR02: 공부시간 내림차순 정렬', () => {
    it('공부시간 기준으로 내림차순 정렬된다', async () => {
      await TestCamStudyTimeLog.bulkCreate([
        {
          userid: 'user1',
          username: '홍길동',
          yearmonthday: '20251207',
          timestamp: Date.now().toString(),
          totalminutes: 180,
        },
        {
          userid: 'user2',
          username: '김철수',
          yearmonthday: '20251207',
          timestamp: Date.now().toString(),
          totalminutes: 300,
        },
        {
          userid: 'user3',
          username: '이영희',
          yearmonthday: '20251207',
          timestamp: Date.now().toString(),
          totalminutes: 120,
        },
      ]);

      const ranking = await TestCamStudyTimeLog.findAll({
        where: { yearmonthday: '20251207' },
        order: [['totalminutes', 'DESC']],
      });

      expect(ranking[0].username).toBe('김철수');
      expect(ranking[1].username).toBe('홍길동');
      expect(ranking[2].username).toBe('이영희');
    });
  });

  describe('TC-CDR03: 시간 포맷팅', () => {
    it('분 단위가 시간:분 형식으로 변환된다', () => {
      // 0분이거나 60분 미만이면 "X분" 형식
      expect(formatFromMinutesToHours(0)).toBe('0분');
      expect(formatFromMinutesToHours(30)).toBe('30분');
      // 60분 이상이면 "X시간 Y분" 형식
      expect(formatFromMinutesToHours(60)).toBe('1시간 0분');
      expect(formatFromMinutesToHours(90)).toBe('1시간 30분');
      expect(formatFromMinutesToHours(150)).toBe('2시간 30분');
    });
  });

  describe('TC-CDR04: 공부 안한 사용자 처리', () => {
    it('등록된 사용자 중 공부 안한 사용자는 0분으로 표시된다', async () => {
      await TestCamStudyUsers.bulkCreate([
        { userid: 'user1', username: '홍길동' },
        { userid: 'user2', username: '김철수' },
      ]);

      await TestCamStudyTimeLog.create({
        userid: 'user1',
        username: '홍길동',
        yearmonthday: '20251207',
        timestamp: Date.now().toString(),
        totalminutes: 180,
      });

      // user2는 공부 안함 - 타임로그 없음
      const camStudyUsers = await TestCamStudyUsers.findAll();
      const timelogs = await TestCamStudyTimeLog.findAll({
        where: { yearmonthday: '20251207' },
      });

      // 모든 사용자에 대해 공부시간 매핑
      const userMinutes = camStudyUsers.map(user => {
        const log = timelogs.find(l => l.userid === user.userid);
        return {
          username: user.username,
          totalminutes: log?.totalminutes ?? 0,
        };
      });

      expect(userMinutes.find(u => u.username === '홍길동')?.totalminutes).toBe(180);
      expect(userMinutes.find(u => u.username === '김철수')?.totalminutes).toBe(0);
    });
  });
});

describe('US-10: 주간 캠스터디 리포트', () => {
  describe('TC-CWR01: 주차 계산', () => {
    it('calculateWeekTimes 함수가 프로젝트 시작일 기준 주차를 반환한다', () => {
      // calculateWeekTimes는 HARUHARU_TIMES 기준으로 몇 주차인지 계산
      // 정확한 값은 HARUHARU_TIMES에 따라 다름
      vi.setSystemTime(new Date('2025-12-07T00:00:00'));
      const weekTimes1 = calculateWeekTimes();

      vi.setSystemTime(new Date('2025-12-14T00:00:00'));
      const weekTimes2 = calculateWeekTimes();

      // 7일 후에는 주차가 1 증가해야 함
      expect(weekTimes2 - weekTimes1).toBe(1);
    });
  });

  describe('TC-CWR02: 주간 누적 시간 업데이트', () => {
    it('일간 공부시간이 주간 로그에 누적된다', async () => {
      const weektimes = 2; // 2주차

      // 기존 주간 로그
      await TestCamStudyWeeklyTimeLog.create({
        userid: 'user1',
        username: '홍길동',
        weektimes: weektimes,
        totalminutes: 300, // 기존 5시간
      });

      // 오늘 공부한 시간
      const todayMinutes = 180; // 3시간

      // 주간 로그 업데이트
      const weekLog = await TestCamStudyWeeklyTimeLog.findOne({
        where: { userid: 'user1', weektimes },
      });
      const updatedMinutes = Number(weekLog!.totalminutes) + todayMinutes;

      await TestCamStudyWeeklyTimeLog.update(
        { totalminutes: updatedMinutes },
        { where: { userid: 'user1', weektimes } },
      );

      const updated = await TestCamStudyWeeklyTimeLog.findOne({
        where: { userid: 'user1', weektimes },
      });
      expect(updated?.totalminutes).toBe(480); // 5 + 3 = 8시간
    });
  });

  describe('TC-CWR03: 신규 주간 로그 생성', () => {
    it('해당 주차에 처음 공부하면 새 주간 로그가 생성된다', async () => {
      const weektimes = 2;
      const todayMinutes = 120;

      // 기존 주간 로그 없음
      const existingLog = await TestCamStudyWeeklyTimeLog.findOne({
        where: { userid: 'user1', weektimes },
      });
      expect(existingLog).toBeNull();

      // 새 주간 로그 생성
      await TestCamStudyWeeklyTimeLog.create({
        userid: 'user1',
        username: '홍길동',
        weektimes: weektimes,
        totalminutes: todayMinutes,
      });

      const newLog = await TestCamStudyWeeklyTimeLog.findOne({
        where: { userid: 'user1', weektimes },
      });
      expect(newLog).not.toBeNull();
      expect(newLog?.totalminutes).toBe(120);
    });
  });

  describe('TC-CWR04: 주간 랭킹', () => {
    it('주간 공부시간 기준으로 내림차순 정렬된다', async () => {
      const weektimes = 2;

      await TestCamStudyWeeklyTimeLog.bulkCreate([
        {
          userid: 'user1',
          username: '홍길동',
          weektimes: weektimes,
          totalminutes: 600, // 10시간
        },
        {
          userid: 'user2',
          username: '김철수',
          weektimes: weektimes,
          totalminutes: 900, // 15시간
        },
        {
          userid: 'user3',
          username: '이영희',
          weektimes: weektimes,
          totalminutes: 480, // 8시간
        },
      ]);

      const ranking = await TestCamStudyWeeklyTimeLog.findAll({
        where: { weektimes },
        order: [['totalminutes', 'DESC']],
      });

      expect(ranking[0].username).toBe('김철수');
      expect(ranking[1].username).toBe('홍길동');
      expect(ranking[2].username).toBe('이영희');
    });
  });

  describe('TC-CWR05: 다른 주차 데이터 분리', () => {
    it('다른 주차의 데이터는 분리되어 조회된다', async () => {
      await TestCamStudyWeeklyTimeLog.bulkCreate([
        {
          userid: 'user1',
          username: '홍길동',
          weektimes: 1, // 1주차
          totalminutes: 300,
        },
        {
          userid: 'user1',
          username: '홍길동',
          weektimes: 2, // 2주차
          totalminutes: 600,
        },
      ]);

      const week1Logs = await TestCamStudyWeeklyTimeLog.findAll({
        where: { weektimes: 1 },
      });
      const week2Logs = await TestCamStudyWeeklyTimeLog.findAll({
        where: { weektimes: 2 },
      });

      expect(week1Logs.length).toBe(1);
      expect(week1Logs[0].totalminutes).toBe(300);
      expect(week2Logs.length).toBe(1);
      expect(week2Logs[0].totalminutes).toBe(600);
    });
  });
});
