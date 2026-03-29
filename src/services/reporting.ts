import {
  listCamStudyTimeLogs,
  listCamStudyTimeLogsBetween,
  listCamStudyUsers,
  listWeeklyCamStudyTimeLogs,
  replaceWeeklyCamStudyTimeLogs,
} from '../repository/camStudyRepository.js';
import {
  listChallengeLogs,
  listChallengeUsers,
  listMonthlySurvivors,
  updateChallengeUser,
} from '../repository/challengeRepository.js';
import { CamStudyTimeLog } from '../repository/CamStudyTimeLog.js';
import { CamStudyUsers } from '../repository/CamStudyUsers.js';
import { CamStudyWeeklyTimeLog } from '../repository/CamStudyWeeklyTimeLog.js';
import { AttendanceLog } from '../repository/AttendanceLog.js';
import { TimeLog } from '../repository/TimeLog.js';
import { Users } from '../repository/Users.js';
import { logger } from '../logger.js';
import { HARUHARU_TIMES, ONE_DAY_MILLISECONDS, PUBLIC_HOLIDAYS_2026, SATURDAY, SUNDAY } from '../utils/constants.js';
import {
  calculateRemainingTimeCamStudy,
  calculateRemainingTimeChallenge,
  calculateWeekTimes,
  formatFromMinutesToHours,
  getYearMonth,
  getYearMonthDate,
  getYearMonthDay,
  isLastDayOfMonth,
  padTwoDigits,
} from '../utils.js';

const syncModels = async () => {
  await Users.sync();
  await TimeLog.sync();
  await AttendanceLog.sync();
  await CamStudyUsers.sync();
  await CamStudyTimeLog.sync();
  await CamStudyWeeklyTimeLog.sync();
};

const buildMonthlyHallOfFameMessage = async (year: number, month: string, date: string) => {
  if (!isLastDayOfMonth(year, Number(month), Number(date))) {
    return null;
  }

  const yearmonth = getYearMonth(year, month);
  const users = await listMonthlySurvivors(yearmonth);
  let message = `### ${year}${month} 생존명단\n`;
  users.forEach(user => {
    message += `- ${user.username}\n`;
  });
  return message;
};

const buildChallengeReport = async () => {
  logger.info('print challenge start');
  const { year, month, date, day } = getYearMonthDate();
  const monthdate = `${month}${date}`;

  if (day === SATURDAY || day === SUNDAY || PUBLIC_HOLIDAYS_2026.includes(monthdate)) {
    const hallOfFameMessage = await buildMonthlyHallOfFameMessage(year, month, date);
    return { attendanceMessage: null, hallOfFameMessage };
  }

  const yearmonth = getYearMonth(year, month);
  const yearmonthday = getYearMonthDay(year, month, date);
  const users = await listChallengeUsers(yearmonth);
  const userMap = new Map(users.map(user => [user.userid, user]));
  const timelogs = await listChallengeLogs(yearmonthday);
  const timelogsGroupById = users.reduce<Record<string, TimeLog[]>>((accumulator, user) => {
    accumulator[user.userid] = [];
    return accumulator;
  }, {});

  timelogs.forEach(timelog => {
    timelogsGroupById[timelog.userid]?.push(timelog);
  });
  logger.info(`user id 로 그룹핑한 timelog 인스턴스들: `, { timelogsGroupById });

  let attendanceMessage = `### ${yearmonthday} 출석표\n`;
  let attendees = '';
  let latecomers = '';
  let absentees = '';

  for (const [userid, logs] of Object.entries(timelogsGroupById)) {
    const user = userMap.get(userid);
    if (!user) {
      continue;
    }

    if (logs.length !== 2) {
      const nextAbsenceCount = (user.absencecount ?? 0) + 1;
      await updateChallengeUser(userid, yearmonth, { absencecount: nextAbsenceCount });
      absentees += `- ${user.username}: 결석 (${nextAbsenceCount}/${user.vacances})\n`;
      continue;
    }

    if (!logs[0].isintime || !logs[1].isintime) {
      const nextLateCount = (user.latecount ?? 0) + 1;
      await updateChallengeUser(userid, yearmonth, { latecount: nextLateCount });
      latecomers += `- ${logs[0].username}: 지각 (${nextLateCount})\n`;
      continue;
    }

    attendees += `- ${logs[0].username}: 출석\n`;
  }

  if (attendees) attendanceMessage += attendees;
  if (latecomers) attendanceMessage += latecomers;
  if (absentees) attendanceMessage += absentees;

  const hallOfFameMessage = await buildMonthlyHallOfFameMessage(year, month, date);
  logger.info(`alarm final string`, { string: attendanceMessage });
  return { attendanceMessage, hallOfFameMessage };
};

const toYearMonthDay = (target: Date) =>
  `${target.getFullYear()}${padTwoDigits(target.getMonth() + 1)}${padTwoDigits(target.getDate())}`;

const buildCamStudyReports = async () => {
  logger.info('print cam_study start');
  const { year, month, date } = getYearMonthDate();
  const yearmonthday = getYearMonthDay(year, month, date);
  const camStudyUsers = await listCamStudyUsers();
  const camStudyTimelogs = await listCamStudyTimeLogs(yearmonthday);
  const camStudyTimeLogMap = new Map(camStudyTimelogs.map(timelog => [timelog.userid, timelog]));
  const userMinutes = camStudyUsers.map(user => {
    const timelog = camStudyTimeLogMap.get(user.userid);
    return {
      totalminutes: Number(timelog?.totalminutes ?? 0),
      username: user.username,
      userid: user.userid,
    };
  });

  userMinutes.sort((a, b) => b.totalminutes - a.totalminutes);
  logger.info(`user id 로 그룹핑한 cam-study timelog 인스턴스들: `, { userMinutes });

  let dailyMessage = `### 일일 타임리스트 (${yearmonthday})\n`;
  userMinutes.forEach(({ username, totalminutes }) => {
    dailyMessage += `- ${username}님의 공부시간: ${formatFromMinutesToHours(totalminutes)}\n`;
  });
  logger.info(`cam study final string`, { string: dailyMessage });

  const weektimes = calculateWeekTimes();
  const weekStartDate = new Date(HARUHARU_TIMES);
  weekStartDate.setHours(0, 0, 0, 0);
  weekStartDate.setDate(weekStartDate.getDate() + weektimes * 7);
  const weeklyTimelogs = await listCamStudyTimeLogsBetween(toYearMonthDay(weekStartDate), yearmonthday);
  const weeklyTotals = new Map<string, { totalminutes: number; username: string }>();

  weeklyTimelogs.forEach(timelog => {
    const current = weeklyTotals.get(timelog.userid);
    const nextTotalMinutes = Number(current?.totalminutes ?? 0) + Number(timelog.totalminutes);

    weeklyTotals.set(timelog.userid, {
      totalminutes: nextTotalMinutes,
      username: timelog.username,
    });
  });

  const weeklyRows = camStudyUsers
    .map(user => ({
      userid: user.userid,
      username: user.username,
      weektimes,
      totalminutes: Number(weeklyTotals.get(user.userid)?.totalminutes ?? 0),
    }))
    .filter(weeklyRow => weeklyRow.totalminutes > 0);

  await replaceWeeklyCamStudyTimeLogs(weektimes, weeklyRows);
  logger.info('cam study weekly totals recalculated', {
    endYearMonthDay: yearmonthday,
    startYearMonthDay: toYearMonthDay(weekStartDate),
    userCount: weeklyRows.length,
    weektimes,
  });

  let weeklyMessage = `### 주간 타임리스트 (${year}${month}: ${weektimes}번째 주)\n`;
  const weeklyTimeLogs = await listWeeklyCamStudyTimeLogs(weektimes);
  weeklyTimeLogs.forEach(weeklyTimeLog => {
    weeklyMessage += `- ${weeklyTimeLog.username}님의 공부시간: ${formatFromMinutesToHours(Number(weeklyTimeLog.totalminutes))}\n`;
  });
  logger.info(`cam study weekly final string`, { weeklyMessage });

  return { dailyMessage, weeklyMessage };
};

const scheduleDailyReports = (onChallengeReport: () => Promise<void>, onCamStudyReport: () => Promise<void>) => {
  let challengeReportInFlight = false;
  const runChallengeReport = async () => {
    if (challengeReportInFlight) {
      logger.warn('Skipping challenge report run because previous run is still in progress');
      return;
    }

    challengeReportInFlight = true;
    try {
      await onChallengeReport();
    } catch (error) {
      logger.error('Error while running scheduled challenge report', { error, reportType: 'challenge' });
    } finally {
      challengeReportInFlight = false;
    }
  };

  let camStudyReportInFlight = false;
  const runCamStudyReport = async () => {
    if (camStudyReportInFlight) {
      logger.warn('Skipping cam study report run because previous run is still in progress');
      return;
    }

    camStudyReportInFlight = true;
    try {
      await onCamStudyReport();
    } catch (error) {
      logger.error('Error while running scheduled cam study report', { error, reportType: 'cam-study' });
    } finally {
      camStudyReportInFlight = false;
    }
  };

  const remainingTimeChallenge = calculateRemainingTimeChallenge();
  setTimeout(() => {
    void runChallengeReport();
    setInterval(() => {
      void runChallengeReport();
    }, ONE_DAY_MILLISECONDS);
  }, remainingTimeChallenge);

  const remainingTimeCamStudy = calculateRemainingTimeCamStudy();
  setTimeout(() => {
    void runCamStudyReport();
    setInterval(() => {
      void runCamStudyReport();
    }, ONE_DAY_MILLISECONDS);
  }, remainingTimeCamStudy);
};

export { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels };
