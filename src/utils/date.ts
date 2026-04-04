import { logger } from '../logger.js';
import {
  HARUHARU_TIMES,
  PUBLIC_HOLIDAYS_2026,
  PRINT_HOURS_CAM_STUDY,
  PRINT_HOURS_CHALLENGE,
  PRINT_HOURS_DAILY_MESSAGE,
  PRINT_MINUTES_CAM_STUDY,
  SATURDAY,
  SUNDAY,
} from './constants.js';

const padTwoDigits = (value: number) => value.toString().padStart(2, '0');

const getYearMonthDate = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: padTwoDigits(now.getMonth() + 1),
    date: padTwoDigits(now.getDate()),
    day: now.getDay(),
    hours: padTwoDigits(now.getHours()),
    minutes: padTwoDigits(now.getMinutes()),
  };
};

const getYearMonth = (year: number, month: string) => `${year}${month}`;

const getYearMonthDay = (year: number, month: string, date: string) => `${year}${month}${date}`;

const isLastDayOfMonth = (year: number, month: number, date: number): boolean => {
  const lastDateOfMonth = new Date(year, month, 0).getDate();
  return date === lastDateOfMonth;
};

const getFormattedYesterday = () => {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}${padTwoDigits(now.getMonth() + 1)}${padTwoDigits(now.getDate())}`;
};

const getFileName = (filename: string) => filename.substring(filename.lastIndexOf('/'));

const getTimeDiffFromNowInMinutes = (timestamp: number) => {
  const now = Date.now();
  const timeDiff = now - timestamp;
  return Math.floor(timeDiff / 1000 / 60);
};

const calculateWeekTimes = () => {
  const { year, month, date } = getYearMonthDate();
  const now = new Date(`${year}-${month}-${date}`);
  return Math.floor((now.getTime() - HARUHARU_TIMES.getTime()) / 1000 / 60 / 60 / 24 / 7);
};

const isChallengeBonusDay = (day: number, monthdate: string) =>
  day === SATURDAY || day === SUNDAY || PUBLIC_HOLIDAYS_2026.includes(monthdate);

const isChallengeBonusDate = (target: Date) =>
  isChallengeBonusDay(target.getDay(), `${padTwoDigits(target.getMonth() + 1)}${padTwoDigits(target.getDate())}`);

const calculateRemainingTime = (hours: number, minutes: number, logLabel: string) => {
  const now = new Date();
  const target = new Date();
  target.setHours(hours);
  target.setMinutes(minutes);
  target.setSeconds(0);
  target.setMilliseconds(0);

  if (now > target) {
    target.setDate(now.getDate() + 1);
  }

  logger.info(`remaining ${logLabel} print time: target - now: ${target.getTime() - now.getTime()}`);
  return target.getTime() - now.getTime();
};

const calculateRemainingTimeChallenge = () => calculateRemainingTime(PRINT_HOURS_CHALLENGE, 0, 'challenge');

const calculateRemainingTimeDailyMessage = () => calculateRemainingTime(PRINT_HOURS_DAILY_MESSAGE, 0, 'daily message');

const calculateRemainingTimeCamStudy = () =>
  calculateRemainingTime(PRINT_HOURS_CAM_STUDY, PRINT_MINUTES_CAM_STUDY, 'cam study');

export {
  calculateRemainingTimeCamStudy,
  calculateRemainingTimeChallenge,
  calculateRemainingTimeDailyMessage,
  calculateWeekTimes,
  getFileName,
  getFormattedYesterday,
  getTimeDiffFromNowInMinutes,
  getYearMonth,
  getYearMonthDate,
  getYearMonthDay,
  isChallengeBonusDate,
  isChallengeBonusDay,
  isLastDayOfMonth,
  padTwoDigits,
};
