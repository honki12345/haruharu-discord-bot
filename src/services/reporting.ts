import {
  listCamStudyActiveSessions,
  listCamStudyTimeLogs,
  listCamStudyTimeLogsBetween,
  listCamStudyUsers,
  listWeeklyCamStudyTimeLogs,
  replaceWeeklyCamStudyTimeLogs,
} from '../repository/camStudyRepository.js';
import {
  listChallengeAttendanceLogs,
  listChallengeUsers,
  listMonthlySurvivors,
  listMonthlyVacationLogs,
  listVacationLogs,
  updateChallengeUser,
} from '../repository/challengeRepository.js';
import { CamStudyTimeLog } from '../repository/CamStudyTimeLog.js';
import { CamStudyUsers } from '../repository/CamStudyUsers.js';
import { CamStudyWeeklyTimeLog } from '../repository/CamStudyWeeklyTimeLog.js';
import { CamStudyActiveSession } from '../repository/CamStudyActiveSession.js';
import { AttendanceLog } from '../repository/AttendanceLog.js';
import { ChallengeUserExclusion } from '../repository/ChallengeUserExclusion.js';
import { ParticipationApplication } from '../repository/ParticipationApplication.js';
import { TimeLog } from '../repository/TimeLog.js';
import { Users } from '../repository/Users.js';
import { VacationLog } from '../repository/VacationLog.js';
import { WaketimeChangeLog } from '../repository/WaketimeChangeLog.js';
import { logger } from '../logger.js';
import { ensureWakeUpMembershipStreakColumns, WakeUpMembership } from '../repository/WakeUpMembership.js';
import { Op } from 'sequelize';
import { HARUHARU_TIMES, ONE_DAY_MILLISECONDS } from '../utils/constants.js';
import { ensureActiveWakeUpMembershipSnapshots } from './challengeSelfService.js';
import {
  calculateRemainingTimeCamStudy,
  calculateRemainingTimeChallenge,
  calculateWeekTimes,
  formatFromMinutesToHours,
  getYearMonth,
  getYearMonthDate,
  getYearMonthDay,
  isChallengeBonusDay,
  isLastDayOfMonth,
  padTwoDigits,
} from '../utils.js';

const DISCORD_MESSAGE_LIMIT = 2000;
type ChallengeReportStatus = 'attended' | 'late' | 'absent' | 'vacation' | 'missing';

const syncModels = async () => {
  await WakeUpMembership.sync();
  await ensureWakeUpMembershipStreakColumns();
  await Users.sync();
  await ChallengeUserExclusion.sync();
  await TimeLog.sync();
  await AttendanceLog.sync();
  await ParticipationApplication.sync();
  await VacationLog.sync();
  await WaketimeChangeLog.sync();
  await CamStudyUsers.sync();
  await CamStudyTimeLog.sync();
  await CamStudyActiveSession.sync();
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

const calculateRemainingVacances = (vacances: number, usedVacationCount: number) =>
  Math.max(vacances - usedVacationCount, 0);

const formatDisplayDate = (yearmonthday: string) =>
  `${yearmonthday.slice(0, 4)}-${yearmonthday.slice(4, 6)}-${yearmonthday.slice(6, 8)}`;

const formatDisplayWaketime = (waketime: string) => {
  if (!/^\d{4}$/.test(waketime)) {
    return waketime;
  }

  return `${waketime.slice(0, 2)}:${waketime.slice(2, 4)}`;
};

const compareChallengeUsersByWaketime = (left: Users, right: Users) => {
  const waketimeCompare = left.waketime.localeCompare(right.waketime);
  if (waketimeCompare !== 0) {
    return waketimeCompare;
  }

  const usernameCompare = left.username.localeCompare(right.username, 'ko');
  if (usernameCompare !== 0) {
    return usernameCompare;
  }

  return left.userid.localeCompare(right.userid);
};

const buildChallengeReportRow = (payload: {
  username: string;
  waketime: string;
  status: 'attended' | 'late' | 'absent' | 'vacation';
  latecount: number;
  absencecount: number;
  remainingVacances: number;
  attendanceStreak?: number;
}) => {
  if (payload.status === 'attended') {
    return `- ${payload.username}(${payload.waketime}): 출석(연속 ${payload.attendanceStreak ?? 1}회)\n`;
  }

  if (payload.status === 'late') {
    return `- ${payload.username}(${payload.waketime}): 지각(누적 ${payload.latecount}회)\n`;
  }

  if (payload.status === 'absent') {
    return `- ${payload.username}(${payload.waketime}): 결석(누적 ${payload.absencecount}회)\n`;
  }

  return `- ${payload.username}(${payload.waketime}): 휴가(잔여 ${payload.remainingVacances}일)\n`;
};

const getAttendanceStreak = (membership: WakeUpMembership | undefined) => {
  const value = membership?.get('attendancestreak');
  return typeof value === 'number' ? value : Number(value ?? 0);
};

const getAttendanceStreakUpdatedOn = (membership: WakeUpMembership | undefined) => {
  const value = membership?.get('attendancestreakupdatedon');
  return typeof value === 'string' ? value : null;
};

const resolveNextAttendanceStreak = ({
  currentStreak,
  isBonusDay,
  status,
}: {
  currentStreak: number;
  isBonusDay: boolean;
  status: ChallengeReportStatus;
}) => {
  if (isBonusDay) {
    return status === 'attended' || status === 'late' ? currentStreak + 1 : currentStreak;
  }

  if (status === 'attended') {
    return currentStreak + 1;
  }

  if (status === 'vacation') {
    return currentStreak;
  }

  return 0;
};

const syncAttendanceStreak = async ({
  membership,
  userid,
  yearmonthday,
  isBonusDay,
  status,
}: {
  membership: WakeUpMembership | undefined;
  userid: string;
  yearmonthday: string;
  isBonusDay: boolean;
  status: ChallengeReportStatus;
}) => {
  const currentStreak = getAttendanceStreak(membership);
  if (getAttendanceStreakUpdatedOn(membership) === yearmonthday) {
    return currentStreak;
  }

  const nextStreak = resolveNextAttendanceStreak({ currentStreak, isBonusDay, status });
  if (!membership) {
    return nextStreak;
  }

  await WakeUpMembership.update(
    {
      attendancestreak: nextStreak,
      attendancestreakupdatedon: yearmonthday,
    } as never,
    {
      where: { userid },
    },
  );
  membership.set('attendancestreak', nextStreak);
  membership.set('attendancestreakupdatedon', yearmonthday);
  return nextStreak;
};

const splitDiscordMessage = (message: string) => {
  if (message.length <= DISCORD_MESSAGE_LIMIT) {
    return [message];
  }

  const chunks: string[] = [];
  const lines = message.match(/[^\n]*\n|[^\n]+/g) ?? [];
  let currentChunk = '';

  const flushChunk = () => {
    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  };

  for (const line of lines) {
    if (line.length > DISCORD_MESSAGE_LIMIT) {
      flushChunk();
      for (let index = 0; index < line.length; index += DISCORD_MESSAGE_LIMIT) {
        chunks.push(line.slice(index, index + DISCORD_MESSAGE_LIMIT));
      }
      continue;
    }

    if (currentChunk.length + line.length > DISCORD_MESSAGE_LIMIT) {
      flushChunk();
    }

    currentChunk += line;
  }

  flushChunk();
  return chunks;
};

const applyBonusAttendanceAdjustment = async (
  payload: {
    userid: string;
    yearmonth: string;
    latecount: number | null;
    absencecount: number | null;
  },
  attendanceLogStatus: AttendanceLog['status'] | undefined,
) => {
  const currentLateCount = payload.latecount ?? 0;
  const currentAbsenceCount = payload.absencecount ?? 0;

  if (attendanceLogStatus !== 'attended' && attendanceLogStatus !== 'late') {
    return;
  }

  if (currentAbsenceCount > 0) {
    await updateChallengeUser(payload.userid, payload.yearmonth, { absencecount: currentAbsenceCount - 1 });
    return;
  }

  if (currentLateCount > 0) {
    await updateChallengeUser(payload.userid, payload.yearmonth, { latecount: currentLateCount - 1 });
  }
};

const buildChallengeReport = async () => {
  logger.info('print challenge start');
  const { year, month, date, day } = getYearMonthDate();
  const monthdate = `${month}${date}`;
  const isBonusDay = isChallengeBonusDay(day, monthdate);
  const yearmonth = getYearMonth(year, month);
  const yearmonthday = getYearMonthDay(year, month, date);
  await ensureWakeUpMembershipStreakColumns();
  await ensureActiveWakeUpMembershipSnapshots(yearmonth);
  const users = await listChallengeUsers(yearmonth);
  const sortedUsers = [...users].sort(compareChallengeUsersByWaketime);
  const userMap = new Map(users.map(user => [user.userid, user]));
  const memberships = await WakeUpMembership.findAll({
    where: {
      userid: {
        [Op.in]: users.map(user => user.userid),
      },
    },
  });
  const membershipsByUserId = new Map(memberships.map(membership => [membership.userid, membership]));
  const attendanceLogs = await listChallengeAttendanceLogs(yearmonthday);
  const dailyVacationLogs = await listVacationLogs(yearmonthday);
  const monthlyVacationLogs = await listMonthlyVacationLogs(yearmonth);
  const attendanceLogsByUserId = new Map(attendanceLogs.map(attendanceLog => [attendanceLog.userid, attendanceLog]));
  const vacationUserIds = new Set(dailyVacationLogs.map(vacationLog => vacationLog.userid));
  const monthlyVacationCountsByUserId = monthlyVacationLogs.reduce<Record<string, number>>(
    (accumulator, vacationLog) => {
      accumulator[vacationLog.userid] = (accumulator[vacationLog.userid] ?? 0) + 1;
      return accumulator;
    },
    {},
  );
  logger.info(`user id 로 그룹핑한 attendanceLog 인스턴스들 요약: `, {
    totalUsers: attendanceLogsByUserId.size,
    attendanceSummary: Array.from(attendanceLogsByUserId.values()).map(log => ({
      userid: log.userid,
      status: log.status,
    })),
  });

  if (isBonusDay) {
    for (const userid of userMap.keys()) {
      const user = userMap.get(userid);
      const streakStatus: ChallengeReportStatus = vacationUserIds.has(userid)
        ? 'vacation'
        : (attendanceLogsByUserId.get(userid)?.status ?? 'missing');

      await syncAttendanceStreak({
        membership: membershipsByUserId.get(userid),
        userid,
        yearmonthday,
        isBonusDay,
        status: streakStatus,
      });

      if (!user || vacationUserIds.has(userid)) {
        continue;
      }

      await applyBonusAttendanceAdjustment(
        {
          userid,
          yearmonth,
          latecount: user.latecount,
          absencecount: user.absencecount,
        },
        attendanceLogsByUserId.get(userid)?.status,
      );
    }

    const hallOfFameMessage = await buildMonthlyHallOfFameMessage(year, month, date);
    return { attendanceMessage: null, hallOfFameMessage };
  }

  let attendanceMessage = `### ${formatDisplayDate(yearmonthday)} 출석표\n`;
  let attendees = '';
  let latecomers = '';
  let vacationers = '';
  let absentees = '';

  for (const user of sortedUsers) {
    const { userid } = user;
    const membership = membershipsByUserId.get(userid);
    if (vacationUserIds.has(userid)) {
      await syncAttendanceStreak({
        membership,
        userid,
        yearmonthday,
        isBonusDay,
        status: 'vacation',
      });
      vacationers += buildChallengeReportRow({
        username: user.username,
        waketime: formatDisplayWaketime(user.waketime),
        status: 'vacation',
        latecount: user.latecount ?? 0,
        absencecount: user.absencecount ?? 0,
        remainingVacances: calculateRemainingVacances(user.vacances ?? 0, monthlyVacationCountsByUserId[userid] ?? 0),
      });
      continue;
    }

    const attendanceLog = attendanceLogsByUserId.get(userid);
    const currentLateCount = user.latecount ?? 0;
    const currentAbsenceCount = user.absencecount ?? 0;
    const remainingVacances = calculateRemainingVacances(
      user.vacances ?? 0,
      monthlyVacationCountsByUserId[userid] ?? 0,
    );

    if (!attendanceLog || attendanceLog.status === 'absent') {
      const nextAbsenceCount = currentAbsenceCount + 1;
      await syncAttendanceStreak({
        membership,
        userid,
        yearmonthday,
        isBonusDay,
        status: attendanceLog?.status === 'absent' ? 'absent' : 'missing',
      });
      await updateChallengeUser(userid, yearmonth, { absencecount: nextAbsenceCount });
      absentees += buildChallengeReportRow({
        username: user.username,
        waketime: formatDisplayWaketime(user.waketime),
        status: 'absent',
        latecount: currentLateCount,
        absencecount: nextAbsenceCount,
        remainingVacances,
      });
      continue;
    }

    if (attendanceLog.status === 'late') {
      const nextLateCount = currentLateCount + 1;
      await syncAttendanceStreak({
        membership,
        userid,
        yearmonthday,
        isBonusDay,
        status: 'late',
      });
      await updateChallengeUser(userid, yearmonth, { latecount: nextLateCount });
      latecomers += buildChallengeReportRow({
        username: user.username,
        waketime: formatDisplayWaketime(user.waketime),
        status: 'late',
        latecount: nextLateCount,
        absencecount: currentAbsenceCount,
        remainingVacances,
      });
      continue;
    }

    const attendanceStreak = await syncAttendanceStreak({
      membership,
      userid,
      yearmonthday,
      isBonusDay,
      status: 'attended',
    });
    attendees += buildChallengeReportRow({
      username: user.username,
      waketime: formatDisplayWaketime(user.waketime),
      status: 'attended',
      latecount: currentLateCount,
      absencecount: currentAbsenceCount,
      remainingVacances,
      attendanceStreak,
    });
  }

  if (attendees) attendanceMessage += attendees;
  if (latecomers) attendanceMessage += latecomers;
  if (vacationers) attendanceMessage += vacationers;
  if (absentees) attendanceMessage += absentees;

  const hallOfFameMessage = await buildMonthlyHallOfFameMessage(year, month, date);
  logger.info(`alarm final string`, { string: attendanceMessage });
  return {
    attendanceMessage,
    attendanceMessages: splitDiscordMessage(attendanceMessage),
    hallOfFameMessage,
  };
};

const toUtcYearMonthDay = (target: Date) =>
  `${target.getUTCFullYear()}${padTwoDigits(target.getUTCMonth() + 1)}${padTwoDigits(target.getUTCDate())}`;

const getWeekStartDate = (weektimes: number) =>
  new Date(
    Date.UTC(
      HARUHARU_TIMES.getUTCFullYear(),
      HARUHARU_TIMES.getUTCMonth(),
      HARUHARU_TIMES.getUTCDate() + weektimes * 7,
    ),
  );

const buildCamStudyReports = async () => {
  logger.info('print cam_study start');
  const { year, month, date } = getYearMonthDate();
  const yearmonthday = getYearMonthDay(year, month, date);
  const activeSessions = await listCamStudyActiveSessions();
  if (activeSessions.length > 0) {
    logger.info('Skipping active cam study sessions from report totals', {
      activeSessionUserIds: activeSessions.map(activeSession => activeSession.userid),
    });
  }
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
  const weekStartDate = getWeekStartDate(weektimes);
  const weekStartYearMonthDay = toUtcYearMonthDay(weekStartDate);
  const weeklyTimelogs = await listCamStudyTimeLogsBetween(weekStartYearMonthDay, yearmonthday);
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
    startYearMonthDay: weekStartYearMonthDay,
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
