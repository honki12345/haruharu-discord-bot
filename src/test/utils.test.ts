import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// logger 모킹 (utils.ts 에서 import 하기 전에 먼저 모킹해야 함)
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  isLastDayOfMonth,
  formatFromMinutesToHours,
  getTimeDiffFromNowInMinutes,
  getYearMonthDate,
  getFormattedYesterday,
  calculateWeekTimes,
  LATE_RANGE_TIME,
  ABSENCE_RANGE_TIME,
  PUBLIC_HOLIDAYS_2025,
} from '../utils.js';

describe('utils.ts', () => {
  describe('isLastDayOfMonth', () => {
    it('12월 31일은 마지막 날이다', () => {
      expect(isLastDayOfMonth(2025, 12, 31)).toBe(true);
    });

    it('12월 30일은 마지막 날이 아니다', () => {
      expect(isLastDayOfMonth(2025, 12, 30)).toBe(false);
    });

    it('윤년 2월 29일은 마지막 날이다', () => {
      expect(isLastDayOfMonth(2024, 2, 29)).toBe(true);
    });

    it('평년 2월 28일은 마지막 날이다', () => {
      expect(isLastDayOfMonth(2025, 2, 28)).toBe(true);
    });

    it('평년 2월 29일은 마지막 날이 아니다 (존재하지 않는 날)', () => {
      // 2025년 2월은 28일까지만 있으므로 29일은 false
      expect(isLastDayOfMonth(2025, 2, 29)).toBe(false);
    });

    it('4월 30일은 마지막 날이다', () => {
      expect(isLastDayOfMonth(2025, 4, 30)).toBe(true);
    });

    it('1월 31일은 마지막 날이다', () => {
      expect(isLastDayOfMonth(2025, 1, 31)).toBe(true);
    });
  });

  describe('formatFromMinutesToHours', () => {
    it('125분은 "2시간 5분"으로 변환된다', () => {
      expect(formatFromMinutesToHours(125)).toBe('2시간 5분');
    });

    it('60분은 "1시간 0분"으로 변환된다', () => {
      expect(formatFromMinutesToHours(60)).toBe('1시간 0분');
    });

    it('45분은 "45분"으로 변환된다 (시간 없이)', () => {
      expect(formatFromMinutesToHours(45)).toBe('45분');
    });

    it('0분은 "0분"으로 변환된다', () => {
      expect(formatFromMinutesToHours(0)).toBe('0분');
    });

    it('120분은 "2시간 0분"으로 변환된다', () => {
      expect(formatFromMinutesToHours(120)).toBe('2시간 0분');
    });

    it('330분은 "5시간 30분"으로 변환된다', () => {
      expect(formatFromMinutesToHours(330)).toBe('5시간 30분');
    });
  });

  describe('getTimeDiffFromNowInMinutes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('10분 전 타임스탬프는 10을 반환한다', () => {
      const now = new Date('2025-12-07T10:00:00').getTime();
      vi.setSystemTime(now);

      const tenMinutesAgo = now - 10 * 60 * 1000;
      expect(getTimeDiffFromNowInMinutes(tenMinutesAgo)).toBe(10);
    });

    it('1시간 전 타임스탬프는 60을 반환한다', () => {
      const now = new Date('2025-12-07T10:00:00').getTime();
      vi.setSystemTime(now);

      const oneHourAgo = now - 60 * 60 * 1000;
      expect(getTimeDiffFromNowInMinutes(oneHourAgo)).toBe(60);
    });

    it('5분 30초 전은 5를 반환한다 (버림)', () => {
      const now = new Date('2025-12-07T10:00:00').getTime();
      vi.setSystemTime(now);

      const fiveAndHalfMinutesAgo = now - (5 * 60 + 30) * 1000;
      expect(getTimeDiffFromNowInMinutes(fiveAndHalfMinutesAgo)).toBe(5);
    });
  });

  describe('getYearMonthDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('2025년 12월 7일 토요일 07:30을 올바르게 반환한다', () => {
      vi.setSystemTime(new Date('2025-12-07T07:30:00'));

      const result = getYearMonthDate();

      expect(result.year).toBe(2025);
      expect(result.month).toBe('12');
      expect(result.date).toBe('07');
      expect(result.day).toBe(0); // 일요일=0, 토요일=6 -> 2025-12-07은 일요일
      expect(result.hours).toBe('07');
      expect(result.minutes).toBe('30');
    });

    it('월/일/시/분이 한 자리수일 때 0을 붙인다', () => {
      vi.setSystemTime(new Date('2025-01-05T06:05:00'));

      const result = getYearMonthDate();

      expect(result.month).toBe('01');
      expect(result.date).toBe('05');
      expect(result.hours).toBe('06');
      expect(result.minutes).toBe('05');
    });
  });

  describe('getFormattedYesterday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('오늘이 2025-12-07이면 어제는 20251206을 반환한다', () => {
      vi.setSystemTime(new Date('2025-12-07T10:00:00'));

      expect(getFormattedYesterday()).toBe('20251206');
    });

    it('월 첫날이면 전월 마지막 날을 반환한다', () => {
      vi.setSystemTime(new Date('2025-12-01T10:00:00'));

      expect(getFormattedYesterday()).toBe('20251130');
    });

    it('연 첫날이면 전년도 12월 31일을 반환한다', () => {
      vi.setSystemTime(new Date('2025-01-01T10:00:00'));

      expect(getFormattedYesterday()).toBe('20241231');
    });
  });

  describe('calculateWeekTimes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('기준일(2024-04-06)과 같은 날은 0주차이다', () => {
      vi.setSystemTime(new Date('2024-04-06T10:00:00'));

      expect(calculateWeekTimes()).toBe(0);
    });

    it('기준일로부터 1주 후(2024-04-13)는 1주차이다', () => {
      vi.setSystemTime(new Date('2024-04-13T10:00:00'));

      expect(calculateWeekTimes()).toBe(1);
    });

    it('기준일로부터 35주 후는 35주차이다', () => {
      // 2024-04-06 + 35주 = 2024-12-07 (약)
      vi.setSystemTime(new Date('2024-12-07T10:00:00'));

      const weeks = calculateWeekTimes();
      expect(weeks).toBe(35);
    });
  });

  describe('상수 값 검증', () => {
    it('LATE_RANGE_TIME은 10분이다', () => {
      expect(LATE_RANGE_TIME).toBe(10);
    });

    it('ABSENCE_RANGE_TIME은 30분이다', () => {
      expect(ABSENCE_RANGE_TIME).toBe(30);
    });

    it('2025년 공휴일에 1월 1일이 포함되어 있다', () => {
      expect(PUBLIC_HOLIDAYS_2025).toContain('0101');
    });

    it('2025년 공휴일에 크리스마스가 포함되어 있다', () => {
      expect(PUBLIC_HOLIDAYS_2025).toContain('1225');
    });
  });
});

describe('체크인/체크아웃 시간 검증 로직', () => {
  // check-in.ts의 시간 검증 로직을 테스트하기 위한 헬퍼 함수
  function calculateTimeDifference(waketime: string, currentHours: string, currentMinutes: string): number {
    const checkinTimeInMinutes = Number(waketime.substring(0, 2)) * 60 + Number(waketime.substring(2));
    const nowTimeInMinutes = Number(currentHours) * 60 + Number(currentMinutes);
    return nowTimeInMinutes - checkinTimeInMinutes;
  }

  function isValidCheckinTime(timeDiff: number): boolean {
    return Math.abs(timeDiff) <= ABSENCE_RANGE_TIME;
  }

  function isOnTime(timeDiff: number): boolean {
    return timeDiff <= LATE_RANGE_TIME;
  }

  describe('체크인 시간 유효성', () => {
    it('기상시간 07:00, 현재 07:05 → 유효 (정시)', () => {
      const timeDiff = calculateTimeDifference('0700', '07', '05');
      expect(timeDiff).toBe(5);
      expect(isValidCheckinTime(timeDiff)).toBe(true);
      expect(isOnTime(timeDiff)).toBe(true);
    });

    it('기상시간 07:00, 현재 07:10 → 유효 (정시 경계)', () => {
      const timeDiff = calculateTimeDifference('0700', '07', '10');
      expect(timeDiff).toBe(10);
      expect(isValidCheckinTime(timeDiff)).toBe(true);
      expect(isOnTime(timeDiff)).toBe(true);
    });

    it('기상시간 07:00, 현재 07:11 → 유효 (지각)', () => {
      const timeDiff = calculateTimeDifference('0700', '07', '11');
      expect(timeDiff).toBe(11);
      expect(isValidCheckinTime(timeDiff)).toBe(true);
      expect(isOnTime(timeDiff)).toBe(false);
    });

    it('기상시간 07:00, 현재 07:30 → 유효 (지각 경계)', () => {
      const timeDiff = calculateTimeDifference('0700', '07', '30');
      expect(timeDiff).toBe(30);
      expect(isValidCheckinTime(timeDiff)).toBe(true);
      expect(isOnTime(timeDiff)).toBe(false);
    });

    it('기상시간 07:00, 현재 07:31 → 무효 (시간 초과)', () => {
      const timeDiff = calculateTimeDifference('0700', '07', '31');
      expect(timeDiff).toBe(31);
      expect(isValidCheckinTime(timeDiff)).toBe(false);
    });

    it('기상시간 07:00, 현재 06:30 → 유효 (30분 전 경계)', () => {
      const timeDiff = calculateTimeDifference('0700', '06', '30');
      expect(timeDiff).toBe(-30);
      expect(isValidCheckinTime(timeDiff)).toBe(true);
    });

    it('기상시간 07:00, 현재 06:29 → 무효 (너무 이른 시간)', () => {
      const timeDiff = calculateTimeDifference('0700', '06', '29');
      expect(timeDiff).toBe(-31);
      expect(isValidCheckinTime(timeDiff)).toBe(false);
    });
  });

  describe('체크아웃 시간 유효성 (기상시간 + 1시간)', () => {
    function isValidCheckoutTime(timeDiff: number): boolean {
      // 체크아웃은 ±10분만 허용
      return Math.abs(timeDiff) <= LATE_RANGE_TIME;
    }

    it('체크아웃 시간 08:00, 현재 08:05 → 유효', () => {
      // 기상시간 07:00 + 1시간 = 08:00
      const checkoutTime = '0800';
      const timeDiff = calculateTimeDifference(checkoutTime, '08', '05');
      expect(timeDiff).toBe(5);
      expect(isValidCheckoutTime(timeDiff)).toBe(true);
    });

    it('체크아웃 시간 08:00, 현재 08:10 → 유효 (경계)', () => {
      const checkoutTime = '0800';
      const timeDiff = calculateTimeDifference(checkoutTime, '08', '10');
      expect(timeDiff).toBe(10);
      expect(isValidCheckoutTime(timeDiff)).toBe(true);
    });

    it('체크아웃 시간 08:00, 현재 08:11 → 무효', () => {
      const checkoutTime = '0800';
      const timeDiff = calculateTimeDifference(checkoutTime, '08', '11');
      expect(timeDiff).toBe(11);
      expect(isValidCheckoutTime(timeDiff)).toBe(false);
    });

    it('체크아웃 시간 08:00, 현재 07:50 → 유효 (10분 전)', () => {
      const checkoutTime = '0800';
      const timeDiff = calculateTimeDifference(checkoutTime, '07', '50');
      expect(timeDiff).toBe(-10);
      expect(isValidCheckoutTime(timeDiff)).toBe(true);
    });

    it('체크아웃 시간 08:00, 현재 07:49 → 무효 (너무 이름)', () => {
      const checkoutTime = '0800';
      const timeDiff = calculateTimeDifference(checkoutTime, '07', '49');
      expect(timeDiff).toBe(-11);
      expect(isValidCheckoutTime(timeDiff)).toBe(false);
    });
  });
});
