import {
  bulkCreateWakeUpMemberships,
  createChallengeUserExclusion,
  countUserVacationLogs,
  createWakeUpMembership,
  createVacationLog,
  createWaketimeChangeLog,
  findChallengeUser,
  findChallengeUserExclusion,
  findVacationLog,
  findWakeUpMembership,
  findWaketimeChangeLog,
  listActiveWakeUpMemberships,
  listChallengeUserExclusions,
  listWakeUpMembershipsByUserIds,
  updateChallengeUser,
  updateWakeUpMembership,
} from '../repository/challengeRepository.js';
import { isValidWakeTime } from '../attendance.js';
import { DEFAULT_VACANCES_COUNT, getYearMonth, getYearMonthDate } from '../utils.js';
import { Users } from '../repository/Users.js';

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

const createChallengeUserSnapshot = async ({
  userId,
  username,
  waketime,
  yearmonth,
}: {
  userId: string;
  username: string;
  waketime: string;
  yearmonth: string;
}) => {
  const [user, created] = await Users.findOrCreate({
    where: {
      userid: userId,
      yearmonth,
    },
    defaults: {
      userid: userId,
      username,
      yearmonth,
      waketime,
      latecount: 0,
      absencecount: 0,
      vacances: DEFAULT_VACANCES_COUNT,
    },
  });

  if (!created && (user.username !== username || user.waketime !== waketime)) {
    await updateChallengeUser(userId, yearmonth, { username, waketime });
  }

  return [user, created] as const;
};

const ensureWakeUpMembershipSnapshot = async (userId: string, yearmonth: string) => {
  const existingUser = await findChallengeUser(userId, yearmonth);
  if (existingUser) {
    return existingUser;
  }

  const membership = await findWakeUpMembership(userId);
  if (!membership || membership.status !== 'active') {
    return null;
  }

  const exclusion = await findChallengeUserExclusion(userId, yearmonth);
  if (exclusion) {
    return null;
  }

  const [user] = await createChallengeUserSnapshot({
    userId,
    username: membership.username,
    waketime: membership.waketime,
    yearmonth,
  });

  return user;
};

const ensureWakeUpMembershipSnapshotForDate = async (userId: string, yearmonthday: string) =>
  ensureWakeUpMembershipSnapshot(userId, yearmonthday.slice(0, 6));

const backfillWakeUpMembershipsFromLatestUsers = async () => {
  const latestUserSnapshot = await Users.findOne({
    attributes: ['yearmonth'],
    order: [['yearmonth', 'DESC']],
  });
  if (!latestUserSnapshot) {
    return;
  }

  const latestUsers = await Users.findAll({
    where: { yearmonth: latestUserSnapshot.yearmonth },
  });
  if (!latestUsers.length) {
    return;
  }

  const existingMemberships = await listWakeUpMembershipsByUserIds(latestUsers.map(user => user.userid));
  const existingMembershipUserIds = new Set(existingMemberships.map(membership => membership.userid));
  const membershipsToCreate = latestUsers
    .filter(user => !existingMembershipUserIds.has(user.userid))
    .map(user => ({
      userid: user.userid,
      username: user.username,
      waketime: user.waketime,
      status: 'active' as const,
      stoppedat: null,
    }));

  if (!membershipsToCreate.length) {
    return;
  }

  await bulkCreateWakeUpMemberships(membershipsToCreate);
};

const findWakeUpMembershipWithLegacyBackfill = async (userId: string) => {
  const existingMembership = await findWakeUpMembership(userId);
  if (existingMembership) {
    return existingMembership;
  }

  await backfillWakeUpMembershipsFromLatestUsers();
  return findWakeUpMembership(userId);
};

const ensureActiveWakeUpMembershipSnapshots = async (yearmonth: string) => {
  await backfillWakeUpMembershipsFromLatestUsers();
  const memberships = await listActiveWakeUpMemberships();
  if (!memberships.length) {
    return;
  }

  const [existingUsers, exclusions] = await Promise.all([
    Users.findAll({
      where: { yearmonth },
      attributes: ['userid'],
    }),
    listChallengeUserExclusions(yearmonth),
  ]);

  const existingUserIdSet = new Set(existingUsers.map(user => user.userid));
  const excludedUserIdSet = new Set(exclusions.map(exclusion => exclusion.userid));
  const snapshotsToCreate = memberships
    .filter(membership => !existingUserIdSet.has(membership.userid) && !excludedUserIdSet.has(membership.userid))
    .map(membership => ({
      userid: membership.userid,
      username: membership.username,
      yearmonth,
      waketime: membership.waketime,
      latecount: 0,
      absencecount: 0,
      vacances: DEFAULT_VACANCES_COUNT,
    }));

  if (!snapshotsToCreate.length) {
    return;
  }

  await Users.bulkCreate(snapshotsToCreate, { ignoreDuplicates: true });
};

const executeRegister = async ({
  userId,
  username,
  waketime,
}: {
  userId: string;
  username: string;
  waketime: string;
}) => {
  if (!isValidChallengeWakeTime(waketime)) {
    return { reply: '기상시간은 05:00부터 09:00 사이 HHmm 형식으로 입력해주세요' };
  }

  const { year, month, date } = getYearMonthDate();
  const yearmonth = getYearMonth(year, month);
  const yearmonthday = `${yearmonth}${date}`;
  const membership = await findWakeUpMembership(userId);
  const user = await findChallengeUser(userId, yearmonth);

  const existingChange = await findWaketimeChangeLog(userId, yearmonthday);
  if (existingChange) {
    return { reply: 'register는 하루에 한 번만 변경할 수 있습니다' };
  }

  if (!membership) {
    await createWakeUpMembership({
      userid: userId,
      username,
      waketime,
      status: 'active',
      stoppedat: null,
    });
  } else {
    await updateWakeUpMembership(userId, {
      username,
      waketime,
      status: 'active',
      stoppedat: null,
    });
  }

  if (!user) {
    await createChallengeUserSnapshot({
      userId,
      username,
      waketime,
      yearmonth,
    });
    await createWaketimeChangeLog({ userid: userId, yearmonthday, waketime });
    return { reply: `${username}님 기상시간을 등록했습니다. 기준월: ${yearmonth}, 기상시간: ${waketime}` };
  }

  await createWaketimeChangeLog({ userid: userId, yearmonthday, waketime });
  await updateChallengeUser(userId, yearmonth, { username, waketime });

  return { reply: `${username}님 기상시간을 수정했습니다. 기준월: ${yearmonth}, 기상시간: ${waketime}` };
};

const findRegisteredUserForDate = async (userId: string, yearmonthday: string) => {
  await ensureWakeUpMembershipSnapshotForDate(userId, yearmonthday);
  return findChallengeUser(userId, yearmonthday.slice(0, 6));
};

const executeApplyVacation = async ({ userId, yearmonthday }: { userId: string; yearmonthday: string }) => {
  if (!isCanonicalYearMonthDay(yearmonthday)) {
    return { reply: '휴가 날짜를 yyyymmdd 형식으로 입력해주세요' };
  }

  const { year, month } = getYearMonthDate();
  const currentYearmonth = getYearMonth(year, month);
  if (yearmonthday.slice(0, 6) !== currentYearmonth) {
    return { reply: '휴가는 현재 월 날짜만 신청할 수 있습니다' };
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

const executeStopWakeUp = async ({ userId }: { userId: string }) => {
  const membership = await findWakeUpMembershipWithLegacyBackfill(userId);
  if (!membership || membership.status !== 'active') {
    return { reply: '현재 진행 중인 기상스터디 참여가 없습니다' };
  }

  await updateWakeUpMembership(userId, {
    status: 'stopped',
    stoppedat: new Date().toISOString(),
  });

  return {
    reply: '기상스터디 참여를 중단했습니다. 현재 월 기록은 유지되고 다음 달부터 자동 등록되지 않습니다',
  };
};

export {
  ensureActiveWakeUpMembershipSnapshots,
  ensureWakeUpMembershipSnapshot,
  ensureWakeUpMembershipSnapshotForDate,
  createChallengeUserExclusion,
  executeApplyVacation,
  executeRegister,
  executeStopWakeUp,
};
