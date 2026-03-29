import {
  createWeeklyCamStudyTimeLog,
  findWeeklyCamStudyTimeLog,
  listCamStudyTimeLogs,
  listCamStudyUsers,
  listWeeklyCamStudyTimeLogs,
  updateWeeklyCamStudyTimeLog,
} from '../repository/camStudyRepository.js';
import {
  listChallengeAttendanceLogs,
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
  const attendanceLogs = await listChallengeAttendanceLogs(yearmonthday);
  const attendanceLogsByUserId = new Map(attendanceLogs.map(attendanceLog => [attendanceLog.userid, attendanceLog]));
  logger.info(`user id 로 그룹핑한 attendanceLog 인스턴스들: `, {
    attendanceLogsByUserId: Object.fromEntries(attendanceLogsByUserId),
  });

  let attendanceMessage = `### ${yearmonthday} 출석표\n`;
  let attendees = '';
  let latecomers = '';
  let absentees = '';

  for (const userid of userMap.keys()) {
    const user = userMap.get(userid);
    if (!user) {
      continue;
    }

    const attendanceLog = attendanceLogsByUserId.get(userid);

    if (!attendanceLog || attendanceLog.status === 'absent') {
      const nextAbsenceCount = (user.absencecount ?? 0) + 1;
      await updateChallengeUser(userid, yearmonth, { absencecount: nextAbsenceCount });
      absentees += `- ${user.username}: 결석 (${nextAbsenceCount}/${user.vacances})\n`;
      continue;
    }

    if (attendanceLog.status === 'late') {
      const nextLateCount = (user.latecount ?? 0) + 1;
      await updateChallengeUser(userid, yearmonth, { latecount: nextLateCount });
      latecomers += `- ${user.username}: 지각 (${nextLateCount})\n`;
      continue;
    }

    attendees += `- ${user.username}: 출석\n`;
  }

  if (attendees) attendanceMessage += attendees;
  if (latecomers) attendanceMessage += latecomers;
  if (absentees) attendanceMessage += absentees;

  const hallOfFameMessage = await buildMonthlyHallOfFameMessage(year, month, date);
  logger.info(`alarm final string`, { string: attendanceMessage });
  return { attendanceMessage, hallOfFameMessage };
};

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
      logger.error('Error while running scheduled challenge report', { error });
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
      logger.error('Error while running scheduled cam study report', { error });
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
