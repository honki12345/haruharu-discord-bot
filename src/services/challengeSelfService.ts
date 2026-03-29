import {
  countUserVacationLogs,
  createVacationLog,
  createWaketimeChangeLog,
  deleteVacationLog,
  findChallengeUser,
  findVacationLog,
  findWaketimeChangeLog,
} from '../repository/challengeRepository.js';
import { isValidWakeTime } from '../attendance.js';
import { getYearMonth, getYearMonthDate } from '../utils.js';

const YEAR_MONTH_DAY_PATTERN = /^\d{8}$/;

const isCanonicalYearMonthDay = (value: string) => {
  if (!YEAR_MONTH_DAY_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const date = Number(value.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, date));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === date;
};

const isValidChallengeWakeTime = (waketime: string) => {
  if (!isValidWakeTime(waketime)) {
    return false;
  }

  const hours = Number(waketime.slice(0, 2));
  const minutes = Number(waketime.slice(2));
  const time = hours * 100 + minutes;
  return time >= 500 && time <= 900;
};

const executeSetWaketime = async ({ userId, waketime }: { userId: string; waketime: string }) => {
  if (!isValidChallengeWakeTime(waketime)) {
    return { reply: 'no valid waketime' };
  }

  const { year, month, date } = getYearMonthDate();
  const yearmonth = getYearMonth(year, month);
  const yearmonthday = `${yearmonth}${date}`;
  const user = await findChallengeUser(userId, yearmonth);

  if (!user) {
    return { reply: '등록된 사용자가 아닙니다' };
  }

  const existingChange = await findWaketimeChangeLog(userId, yearmonthday);
  if (existingChange) {
    return { reply: '기상시간은 하루에 한 번만 변경할 수 있습니다' };
  }

  await createWaketimeChangeLog({ userid: userId, yearmonthday, waketime });
  await user.update({ waketime });

  return { reply: `${user.username}님 기상시간이 ${waketime}로 변경되었습니다` };
};

const findRegisteredUserForDate = async (userId: string, yearmonthday: string) =>
  findChallengeUser(userId, yearmonthday.slice(0, 6));

const executeApplyVacation = async ({ userId, yearmonthday }: { userId: string; yearmonthday: string }) => {
  if (!isCanonicalYearMonthDay(yearmonthday)) {
    return { reply: '휴가 날짜를 yyyymmdd 형식으로 입력해주세요' };
  }

  const user = await findRegisteredUserForDate(userId, yearmonthday);
  if (!user) {
    return { reply: '등록된 사용자가 아닙니다' };
  }

  const existingVacation = await findVacationLog(userId, yearmonthday);
  if (existingVacation) {
    return { reply: '이미 휴가를 등록한 날짜입니다' };
  }

  const usedVacations = await countUserVacationLogs(userId, yearmonthday.slice(0, 6));
  if (usedVacations >= user.vacances) {
    return { reply: '잔여 휴가가 없습니다' };
  }

  await createVacationLog({
    userid: userId,
    username: user.username,
    yearmonthday,
  });

  return { reply: `${user.username}님 ${yearmonthday} 휴가를 등록했습니다` };
};

const executeCancelVacation = async ({ userId, yearmonthday }: { userId: string; yearmonthday: string }) => {
  if (!isCanonicalYearMonthDay(yearmonthday)) {
    return { reply: '휴가 날짜를 yyyymmdd 형식으로 입력해주세요' };
  }

  const existingVacation = await findVacationLog(userId, yearmonthday);
  if (!existingVacation) {
    return { reply: '등록된 휴가가 없습니다' };
  }

  await deleteVacationLog(userId, yearmonthday);
  return { reply: `${yearmonthday} 휴가를 취소했습니다` };
};

export { executeApplyVacation, executeCancelVacation, executeSetWaketime };
