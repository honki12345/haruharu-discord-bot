import type { Guild, GuildMember } from 'discord.js';
import { QueryTypes, type Transaction } from 'sequelize';
import {
  bulkCreateWakeUpMemberships,
  createChallengeUserExclusion,
  countUserVacationLogs,
  createVacationLog,
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
import { wakeUpRoleId } from '../config.js';
import { logger } from '../logger.js';
import { hasDiscordDisplayNameChanged, resolveDiscordDisplayName } from '../utils/discordName.js';
import { DEFAULT_VACANCES_COUNT, getYearMonth, getYearMonthDate } from '../utils.js';
import { Users } from '../repository/Users.js';
import { WakeUpMembership } from '../repository/WakeUpMembership.js';
import { WaketimeChangeLog } from '../repository/WaketimeChangeLog.js';
import { ChallengeUserExclusion } from '../repository/ChallengeUserExclusion.js';

const YEAR_MONTH_DAY_PATTERN = /^\d{8}$/;
const FOUR_DIGIT_WAKE_TIME_PATTERN = /^\d{4}$/;
const COLON_WAKE_TIME_PATTERN = /^\d{2}:\d{2}$/;

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

const normalizeChallengeWakeTime = (waketime: string) => {
  const canonicalWakeTime = FOUR_DIGIT_WAKE_TIME_PATTERN.test(waketime)
    ? waketime
    : COLON_WAKE_TIME_PATTERN.test(waketime)
      ? waketime.replace(':', '')
      : null;

  if (!canonicalWakeTime || !isValidWakeTime(canonicalWakeTime)) {
    return null;
  }

  const hours = Number(canonicalWakeTime.slice(0, 2));
  const minutes = Number(canonicalWakeTime.slice(2));
  const time = hours * 100 + minutes;
  return time >= 500 && time <= 900 ? canonicalWakeTime : null;
};

type RegisterContext = {
  userId: string;
  username: string;
  waketime: string;
  yearmonth: string;
  yearmonthday: string;
};

type CommandResult = {
  reply: string;
};

type GuildMemberResult = CommandResult | { member: GuildMember };
type WakeUpRoleResult = CommandResult | { member: GuildMember; hadRoleBeforeMutation: boolean };
const wakeUpUserLocks = new Map<string, Promise<void>>();

const runChallengeTransaction = async <T>(callback: (transaction: Transaction) => Promise<T>) => {
  const sequelize = Users.sequelize;
  if (!sequelize) {
    throw new Error('Users sequelize is not initialized');
  }

  return sequelize.transaction(callback);
};

const runWithWakeUpUserLock = async <T>(userId: string, callback: () => Promise<T>) => {
  const previous = wakeUpUserLocks.get(userId) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>(resolve => {
    release = () => resolve();
  });
  const queued = previous.catch(() => undefined).then(() => current);
  wakeUpUserLocks.set(userId, queued);

  await previous.catch(() => undefined);

  try {
    return await callback();
  } finally {
    release();
    if (wakeUpUserLocks.get(userId) === queued) {
      wakeUpUserLocks.delete(userId);
    }
  }
};

const ensureWakeUpMembershipStreakColumns = async (transaction: Transaction) => {
  const sequelize = Users.sequelize;
  if (!sequelize) {
    throw new Error('Users sequelize is not initialized');
  }

  const columns = await sequelize.query<{ name: string }>('PRAGMA table_info("wake_up_memberships")', {
    transaction,
    type: QueryTypes.SELECT,
  });
  const columnNames = new Set(columns.map(column => column.name));

  if (!columnNames.has('attendancestreak')) {
    await sequelize.query(
      'ALTER TABLE "wake_up_memberships" ADD COLUMN "attendancestreak" INTEGER NOT NULL DEFAULT 0',
      {
        transaction,
      },
    );
  }

  if (!columnNames.has('attendancestreakupdatedon')) {
    await sequelize.query('ALTER TABLE "wake_up_memberships" ADD COLUMN "attendancestreakupdatedon" TEXT', {
      transaction,
    });
  }
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

const syncWakeUpMemberState = async (member: GuildMember) => {
  const membership = await findWakeUpMembership(member.user.id);
  if (!membership || membership.status !== 'active') {
    return;
  }

  const username = resolveDiscordDisplayName(member);
  const { year, month } = getYearMonthDate();
  const yearmonth = getYearMonth(year, month);
  const currentMonthUser = await findChallengeUser(member.user.id, yearmonth);
  const updatedMembership = membership.username !== username;
  const updatedCurrentMonthSnapshot = Boolean(currentMonthUser && currentMonthUser.username !== username);

  if (updatedMembership) {
    await updateWakeUpMembership(member.user.id, { username });
  }

  if (updatedCurrentMonthSnapshot) {
    await updateChallengeUser(member.user.id, yearmonth, { username });
  }

  if (updatedMembership || updatedCurrentMonthSnapshot) {
    logger.info('wake-up member username synced from guildMemberUpdate', {
      userid: member.user.id,
      username,
      yearmonth,
      updatedMembership,
      updatedCurrentMonthSnapshot,
    });
  }
};

const syncWakeUpMemberProfile = async (oldMember: GuildMember, newMember: GuildMember) => {
  if (!hasDiscordDisplayNameChanged(oldMember, newMember)) {
    return;
  }

  await syncWakeUpMemberState(newMember);
};

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

const prepareRegister = async ({
  userId,
  username,
  waketime,
  yearmonth,
  yearmonthday,
}: RegisterContext): Promise<CommandResult | RegisterContext> => {
  const normalizedWakeTime = normalizeChallengeWakeTime(waketime);
  if (!normalizedWakeTime) {
    return { reply: '기상시간은 05:00부터 09:00 사이 HHmm 또는 HH:mm 형식으로 입력해주세요' };
  }

  const membership = await findWakeUpMembership(userId);
  const currentMonthExclusion =
    membership?.status === 'stopped' ? await findChallengeUserExclusion(userId, yearmonth) : null;

  if (membership?.status === 'stopped' && currentMonthExclusion) {
    return { reply: '이번 달에 중단한 기상스터디는 다음 달부터 다시 등록할 수 있습니다' };
  }

  const existingChange = await findWaketimeChangeLog(userId, yearmonthday);
  if (existingChange) {
    return { reply: 'register는 하루에 한 번만 변경할 수 있습니다' };
  }

  return { userId, username, waketime: normalizedWakeTime, yearmonth, yearmonthday };
};

const persistRegister = async ({
  userId,
  username,
  waketime,
  yearmonth,
  yearmonthday,
}: RegisterContext): Promise<CommandResult> =>
  runChallengeTransaction(async transaction => {
    const membership = await WakeUpMembership.findOne({
      where: { userid: userId },
      transaction,
    });
    const user = await Users.findOne({
      where: { userid: userId, yearmonth },
      transaction,
    });
    const existingChange = await WaketimeChangeLog.findOne({
      where: { userid: userId, yearmonthday },
      transaction,
    });

    if (existingChange) {
      return { reply: 'register는 하루에 한 번만 변경할 수 있습니다' };
    }

    if (!membership) {
      await WakeUpMembership.create(
        {
          userid: userId,
          username,
          waketime,
          status: 'active',
          stoppedat: null,
        },
        { transaction },
      );
    } else {
      await WakeUpMembership.update(
        {
          username,
          waketime,
          status: 'active',
          stoppedat: null,
        },
        {
          where: { userid: userId },
          transaction,
        },
      );
    }

    const [currentUser, created] = await Users.findOrCreate({
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
      transaction,
    });

    if (!created && (currentUser.username !== username || currentUser.waketime !== waketime)) {
      await Users.update(
        {
          username,
          waketime,
        },
        {
          where: { userid: userId, yearmonth },
          transaction,
        },
      );
    }

    await WaketimeChangeLog.create(
      {
        userid: userId,
        yearmonthday,
        waketime,
      },
      { transaction },
    );

    if (!user) {
      return { reply: `${username}님 기상시간을 등록했습니다. 기준월: ${yearmonth}, 기상시간: ${waketime}` };
    }

    return { reply: `${username}님 기상시간을 수정했습니다. 기준월: ${yearmonth}, 기상시간: ${waketime}` };
  });

const executeRegister = async ({
  userId,
  username,
  waketime,
}: {
  userId: string;
  username: string;
  waketime: string;
}): Promise<CommandResult> =>
  runWithWakeUpUserLock(userId, async () => {
    const { year, month, date } = getYearMonthDate();
    const yearmonth = getYearMonth(year, month);
    const yearmonthday = `${yearmonth}${date}`;
    const prepared = await prepareRegister({
      userId,
      username,
      waketime,
      yearmonth,
      yearmonthday,
    });

    if ('reply' in prepared) {
      return prepared;
    }

    return persistRegister(prepared);
  });

const findRegisteredUserForDate = async (userId: string, yearmonthday: string) => {
  await ensureWakeUpMembershipSnapshotForDate(userId, yearmonthday);
  return findChallengeUser(userId, yearmonthday.slice(0, 6));
};

const executeApplyVacation = async ({
  userId,
  yearmonthday,
}: {
  userId: string;
  yearmonthday: string;
}): Promise<CommandResult> => {
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

const prepareStopWakeUp = async ({
  userId,
}: {
  userId: string;
}): Promise<CommandResult | { userId: string; currentYearmonth: string }> => {
  const { year, month } = getYearMonthDate();
  const currentYearmonth = getYearMonth(year, month);
  const membership = await findWakeUpMembershipWithLegacyBackfill(userId);
  if (!membership || membership.status !== 'active') {
    return { reply: '현재 진행 중인 기상스터디 참여가 없습니다' };
  }

  return { userId, currentYearmonth };
};

const persistStopWakeUp = async ({
  userId,
  currentYearmonth,
}: {
  userId: string;
  currentYearmonth: string;
}): Promise<CommandResult> =>
  runChallengeTransaction(async transaction => {
    const sequelize = Users.sequelize;
    if (!sequelize) {
      throw new Error('Users sequelize is not initialized');
    }

    const membership = await WakeUpMembership.findOne({
      where: { userid: userId },
      transaction,
    });
    if (!membership || membership.status !== 'active') {
      return { reply: '현재 진행 중인 기상스터디 참여가 없습니다' };
    }

    const stoppedAt = new Date().toISOString();
    await ensureWakeUpMembershipStreakColumns(transaction);
    await sequelize.query(
      `UPDATE wake_up_memberships
       SET status = 'stopped',
           stoppedat = :stoppedAt,
           attendancestreak = 0,
           attendancestreakupdatedon = NULL
       WHERE userid = :userId`,
      {
        replacements: {
          stoppedAt,
          userId,
        },
        transaction,
      },
    );
    await ChallengeUserExclusion.bulkCreate([{ userid: userId, yearmonth: currentYearmonth }], {
      ignoreDuplicates: true,
      transaction,
    });
    await Users.destroy({
      where: { userid: userId, yearmonth: currentYearmonth },
      transaction,
    });

    return {
      reply: '기상스터디 참여를 중단했습니다. 이번 달 참여는 즉시 중단되며 다음 달부터 다시 등록할 수 있습니다',
    };
  });

const fetchWakeUpGuildMember = async (guild: Guild | null, userId: string): Promise<GuildMemberResult> => {
  if (!guild) {
    return { reply: '서버 안에서만 기상스터디 참여를 처리할 수 있습니다' };
  }

  try {
    const member = (await guild.members.fetch(userId)) as GuildMember;
    return { member };
  } catch (error) {
    logger.error('failed to fetch guild member for wake-up role sync', { error, userId, roleId: wakeUpRoleId });
    return { reply: '서버에서 사용자를 찾을 수 없어요. 서버에 남아 있는지 확인해 주세요.' };
  }
};

const hasWakeUpRole = (member: GuildMember) => member.roles.cache?.has(wakeUpRoleId) ?? false;

const grantWakeUpRole = async (guild: Guild | null, userId: string): Promise<WakeUpRoleResult> => {
  const fetchedMember = await fetchWakeUpGuildMember(guild, userId);
  if ('reply' in fetchedMember) {
    return fetchedMember;
  }

  const hadRoleBeforeMutation = hasWakeUpRole(fetchedMember.member);

  try {
    await fetchedMember.member.roles.add(wakeUpRoleId);
    return { member: fetchedMember.member, hadRoleBeforeMutation };
  } catch (error) {
    logger.error('failed to grant wake-up role', { error, userId, roleId: wakeUpRoleId });
    return { reply: '@wake-up 역할을 부여하지 못했어요. 봇 권한과 역할 설정을 확인한 뒤 다시 시도해 주세요.' };
  }
};

const revokeWakeUpRole = async (guild: Guild | null, userId: string): Promise<WakeUpRoleResult> => {
  const fetchedMember = await fetchWakeUpGuildMember(guild, userId);
  if ('reply' in fetchedMember) {
    return fetchedMember;
  }

  const hadRoleBeforeMutation = hasWakeUpRole(fetchedMember.member);

  try {
    await fetchedMember.member.roles.remove(wakeUpRoleId);
    return { member: fetchedMember.member, hadRoleBeforeMutation };
  } catch (error) {
    logger.error('failed to revoke wake-up role', { error, userId, roleId: wakeUpRoleId });
    return { reply: '@wake-up 역할을 회수하지 못했어요. 봇 권한과 역할 설정을 확인한 뒤 다시 시도해 주세요.' };
  }
};

const executeRegisterWithRoleSync = async ({
  userId,
  username,
  waketime,
  guild,
}: {
  userId: string;
  username: string;
  waketime: string;
  guild: Guild | null;
}): Promise<CommandResult> =>
  runWithWakeUpUserLock(userId, async () => {
    const { year, month, date } = getYearMonthDate();
    const yearmonth = getYearMonth(year, month);
    const yearmonthday = `${yearmonth}${date}`;
    const prepared = await prepareRegister({
      userId,
      username,
      waketime,
      yearmonth,
      yearmonthday,
    });

    if ('reply' in prepared) {
      return prepared;
    }

    const roleResult = await grantWakeUpRole(guild, userId);
    if ('reply' in roleResult) {
      return roleResult;
    }

    try {
      return await persistRegister(prepared);
    } catch (error) {
      logger.error('register persistence failed after wake-up role grant', { error, userId, roleId: wakeUpRoleId });

      if (!roleResult.hadRoleBeforeMutation) {
        try {
          await roleResult.member.roles.remove(wakeUpRoleId);
        } catch (rollbackError) {
          logger.error('failed to rollback wake-up role after register persistence error', {
            rollbackError,
            userId,
            roleId: wakeUpRoleId,
          });
        }
      }

      throw error;
    }
  });

const executeStopWakeUp = async ({ userId }: { userId: string }): Promise<CommandResult> =>
  runWithWakeUpUserLock(userId, async () => {
    const prepared = await prepareStopWakeUp({ userId });
    if ('reply' in prepared) {
      return prepared;
    }

    return persistStopWakeUp(prepared);
  });

const executeStopWakeUpWithRoleSync = async ({
  userId,
  guild,
}: {
  userId: string;
  guild: Guild | null;
}): Promise<CommandResult> =>
  runWithWakeUpUserLock(userId, async () => {
    const prepared = await prepareStopWakeUp({ userId });
    if ('reply' in prepared) {
      return prepared;
    }

    const roleResult = await revokeWakeUpRole(guild, userId);
    if ('reply' in roleResult) {
      return roleResult;
    }

    try {
      return await persistStopWakeUp(prepared);
    } catch (error) {
      logger.error('stop-wakeup persistence failed after wake-up role revoke', { error, userId, roleId: wakeUpRoleId });

      try {
        await roleResult.member.roles.add(wakeUpRoleId);
      } catch (rollbackError) {
        logger.error('failed to rollback wake-up role after stop persistence error', {
          rollbackError,
          userId,
          roleId: wakeUpRoleId,
        });
      }

      throw error;
    }
  });

export {
  ensureActiveWakeUpMembershipSnapshots,
  ensureWakeUpMembershipSnapshot,
  ensureWakeUpMembershipSnapshotForDate,
  createChallengeUserExclusion,
  executeApplyVacation,
  executeRegister,
  executeRegisterWithRoleSync,
  executeStopWakeUp,
  executeStopWakeUpWithRoleSync,
  syncWakeUpMemberProfile,
  syncWakeUpMemberState,
};
