import {
  createWeeklyCamStudyTimeLog,
  findWeeklyCamStudyTimeLog,
  listCamStudyTimeLogs,
  listCamStudyUsers,
  listWeeklyCamStudyTimeLogs,
  updateWeeklyCamStudyTimeLog,
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
import { TimeLog } from '../repository/TimeLog.js';
import { Users } from '../repository/Users.js';
import { logger } from '../logger.js';
import { ONE_DAY_MILLISECONDS, PUBLIC_HOLIDAYS_2026, SATURDAY, SUNDAY } from '../utils/constants.js';
import {
  calculateRemainingTimeCamStudy,
  calculateRemainingTimeChallenge,
  calculateWeekTimes,
  formatFromMinutesToHours,
  getYearMonth,
  getYearMonthDate,
  getYearMonthDay,
  isLastDayOfMonth,
} from '../utils.js';

const syncModels = async () => {
  await Users.sync();
  await TimeLog.sync();
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
  const hallOfFameMessage = await buildMonthlyHallOfFameMessage(year, month, date);
  const monthdate = `${month}${date}`;

  if (day === SATURDAY || day === SUNDAY || PUBLIC_HOLIDAYS_2026.includes(monthdate)) {
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
      await updateChallengeUser(userid, yearmonth, { absencecount: user.absencecount + 1 });
      absentees += `- ${user.username}: 결석 (${user.absencecount + 1}/${user.vacances})\n`;
      continue;
    }

    if (!logs[0].isintime || !logs[1].isintime) {
      await updateChallengeUser(userid, yearmonth, { latecount: user.latecount + 1 });
      latecomers += `- ${logs[0].username}: 지각 (${user.latecount + 1})\n`;
      continue;
    }

    attendees += `- ${logs[0].username}: 출석\n`;
  }

  if (attendees) attendanceMessage += attendees;
  if (latecomers) attendanceMessage += latecomers;
  if (absentees) attendanceMessage += absentees;

  logger.info(`alarm final string`, { string: attendanceMessage });
  return { attendanceMessage, hallOfFameMessage };
};

const buildCamStudyReports = async () => {
  logger.info('print cam_study start');
  const { year, month, date } = getYearMonthDate();
  const yearmonthday = getYearMonthDay(year, month, date);
  const camStudyUsers = await listCamStudyUsers();
  const camStudyTimelogs = await listCamStudyTimeLogs(yearmonthday);
  const userMinutes = camStudyUsers.map(user => {
    const timelog = camStudyTimelogs.find(entry => entry.userid === user.userid);
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
  for (const timelog of camStudyTimelogs) {
    const weekTimeLog = await findWeeklyCamStudyTimeLog(timelog.userid, weektimes);
    const totalminutes = Number(timelog.totalminutes);

    if (weekTimeLog) {
      await updateWeeklyCamStudyTimeLog(timelog.userid, weektimes, Number(weekTimeLog.totalminutes) + totalminutes);
      continue;
    }

    await createWeeklyCamStudyTimeLog({
      userid: timelog.userid,
      username: timelog.username,
      weektimes,
      totalminutes,
    });
  }

  let weeklyMessage = `### 주간 타임리스트 (${year}${month}: ${weektimes}번째 주)\n`;
  const weeklyTimeLogs = await listWeeklyCamStudyTimeLogs(weektimes);
  weeklyTimeLogs.forEach(weeklyTimeLog => {
    weeklyMessage += `- ${weeklyTimeLog.username}님의 공부시간: ${formatFromMinutesToHours(Number(weeklyTimeLog.totalminutes))}\n`;
  });
  logger.info(`cam study weekly final string`, { weeklyMessage });

  return { dailyMessage, weeklyMessage };
};

const scheduleDailyReports = (
  onChallengeReport: () => Promise<void>,
  onCamStudyReport: () => Promise<void>,
) => {
  const remainingTimeChallenge = calculateRemainingTimeChallenge();
  setTimeout(() => {
    void onChallengeReport();
    setInterval(() => void onChallengeReport(), ONE_DAY_MILLISECONDS);
  }, remainingTimeChallenge);

  const remainingTimeCamStudy = calculateRemainingTimeCamStudy();
  setTimeout(() => {
    void onCamStudyReport();
    setInterval(() => void onCamStudyReport(), ONE_DAY_MILLISECONDS);
  }, remainingTimeCamStudy);
};

export { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels };
