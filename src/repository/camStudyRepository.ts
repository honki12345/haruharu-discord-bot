import { CamStudyActiveSession } from './CamStudyActiveSession.js';
import { Op, UniqueConstraintError } from 'sequelize';
import { CamStudyTimeLog } from './CamStudyTimeLog.js';
import { CamStudyUsers } from './CamStudyUsers.js';
import { CamStudyWeeklyTimeLog } from './CamStudyWeeklyTimeLog.js';

const findCamStudyUser = (userid: string) => CamStudyUsers.findOne({ where: { userid } });

const listCamStudyUsers = () => CamStudyUsers.findAll();

const camStudyUserMutationQueue = new Map<string, Promise<void>>();

const runSerializedCamStudyUserMutation = async <T>(userid: string, operation: () => Promise<T>) => {
  const previous = camStudyUserMutationQueue.get(userid) ?? Promise.resolve();
  let releaseCurrentQueue!: () => void;
  const current = new Promise<void>(resolve => {
    releaseCurrentQueue = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);

  camStudyUserMutationQueue.set(userid, queued);
  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    releaseCurrentQueue();
    if (camStudyUserMutationQueue.get(userid) === queued) {
      camStudyUserMutationQueue.delete(userid);
    }
  }
};

const upsertCamStudyUser = (payload: { userid: string; username: string }) =>
  runSerializedCamStudyUserMutation(payload.userid, async () => {
    const existingUsers = await CamStudyUsers.findAll({
      where: { userid: payload.userid },
      order: [['id', 'ASC']],
    });

    if (existingUsers.length === 0) {
      return CamStudyUsers.create(payload);
    }

    const [primaryUser, ...duplicateUsers] = existingUsers;
    await CamStudyUsers.update(
      {
        username: payload.username,
      },
      {
        where: { id: primaryUser.id },
      },
    );

    if (duplicateUsers.length > 0) {
      await CamStudyUsers.destroy({
        where: {
          id: {
            [Op.in]: duplicateUsers.map(user => user.id),
          },
        },
      });
    }

    return CamStudyUsers.findOne({
      where: { id: primaryUser.id },
    });
  });

const deleteCamStudyUser = (userid: string) =>
  runSerializedCamStudyUserMutation(userid, async () =>
    CamStudyUsers.destroy({
      where: { userid },
    }),
  );

const findCamStudyActiveSession = (userid: string) => CamStudyActiveSession.findOne({ where: { userid } });

const listCamStudyActiveSessions = () => CamStudyActiveSession.findAll();

const createCamStudyActiveSession = (payload: {
  userid: string;
  username: string;
  channelid: string;
  startedat: string;
  lastobservedat: string;
}) => CamStudyActiveSession.create(payload);

const createOrRefreshCamStudyActiveSession = async (payload: {
  userid: string;
  username: string;
  channelid: string;
  startedat: string;
  lastobservedat: string;
}) => {
  const mergePayload = (
    existing: Pick<CamStudyActiveSession, 'startedat' | 'lastobservedat'>,
    incoming: Pick<CamStudyActiveSession, 'startedat' | 'lastobservedat'>,
  ) => ({
    startedat: Math.min(Number(existing.startedat), Number(incoming.startedat)).toString(),
    lastobservedat: Math.max(Number(existing.lastobservedat), Number(incoming.lastobservedat)).toString(),
  });

  const existing = await findCamStudyActiveSession(payload.userid);
  if (existing) {
    const merged = mergePayload(existing, payload);
    await updateCamStudyActiveSession(payload.userid, {
      channelid: payload.channelid,
      lastobservedat: merged.lastobservedat,
      startedat: merged.startedat,
      username: payload.username,
    });
    return merged;
  }

  try {
    await createCamStudyActiveSession(payload);
    return {
      startedat: payload.startedat,
      lastobservedat: payload.lastobservedat,
    };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) {
      throw error;
    }

    const concurrent = await findCamStudyActiveSession(payload.userid);
    if (!concurrent) {
      throw error;
    }

    const merged = mergePayload(concurrent, payload);
    await updateCamStudyActiveSession(payload.userid, {
      channelid: payload.channelid,
      lastobservedat: merged.lastobservedat,
      startedat: merged.startedat,
      username: payload.username,
    });
    return merged;
  }
};

const updateCamStudyActiveSession = (
  userid: string,
  values: Partial<Pick<CamStudyActiveSession, 'channelid' | 'startedat' | 'lastobservedat' | 'username'>>,
) => CamStudyActiveSession.update(values, { where: { userid } });

const deleteCamStudyActiveSession = (userid: string) => CamStudyActiveSession.destroy({ where: { userid } });

const deleteCamStudyActiveSessionMatching = (payload: { userid: string; startedat: string; lastobservedat: string }) =>
  CamStudyActiveSession.destroy({
    where: {
      lastobservedat: payload.lastobservedat,
      startedat: payload.startedat,
      userid: payload.userid,
    },
  });

const findCamStudyTimeLog = (userid: string, yearmonthday: string) =>
  CamStudyTimeLog.findOne({ where: { userid, yearmonthday } });

const createCamStudyTimeLog = (payload: {
  userid: string;
  username: string;
  yearmonthday: string;
  timestamp: string;
  totalminutes: number;
}) => CamStudyTimeLog.create(payload);

const updateCamStudyTimeLog = (
  userid: string,
  yearmonthday: string,
  values: Partial<Pick<CamStudyTimeLog, 'timestamp' | 'totalminutes'>>,
) => CamStudyTimeLog.update(values, { where: { userid, yearmonthday } });

const listCamStudyTimeLogs = (yearmonthday: string) => CamStudyTimeLog.findAll({ where: { yearmonthday } });

const listCamStudyTimeLogsBetween = (startYearMonthDay: string, endYearMonthDay: string) =>
  CamStudyTimeLog.findAll({
    where: {
      yearmonthday: {
        [Op.between]: [startYearMonthDay, endYearMonthDay],
      },
    },
  });

const findWeeklyCamStudyTimeLog = (userid: string, weektimes: number) =>
  CamStudyWeeklyTimeLog.findOne({ where: { userid, weektimes } });

const createWeeklyCamStudyTimeLog = (payload: {
  userid: string;
  username: string;
  weektimes: number;
  totalminutes: number;
}) => CamStudyWeeklyTimeLog.create(payload);

const updateWeeklyCamStudyTimeLog = (userid: string, weektimes: number, totalminutes: number) =>
  CamStudyWeeklyTimeLog.update({ totalminutes }, { where: { userid, weektimes } });

const listWeeklyCamStudyTimeLogs = (weektimes: number) =>
  CamStudyWeeklyTimeLog.findAll({ where: { weektimes }, order: [['totalminutes', 'DESC']] });

const replaceWeeklyCamStudyTimeLogs = async (
  weektimes: number,
  payloads: Array<{
    userid: string;
    username: string;
    weektimes: number;
    totalminutes: number;
  }>,
) => {
  const sequelize = CamStudyWeeklyTimeLog.sequelize;
  if (!sequelize) {
    throw new Error('CamStudyWeeklyTimeLog sequelize instance is not initialized');
  }

  await sequelize.transaction(async transaction => {
    await CamStudyWeeklyTimeLog.destroy({ where: { weektimes }, transaction });

    if (!payloads.length) {
      return;
    }

    await CamStudyWeeklyTimeLog.bulkCreate(payloads, { transaction });
  });
};

export {
  createCamStudyActiveSession,
  createOrRefreshCamStudyActiveSession,
  createCamStudyTimeLog,
  createWeeklyCamStudyTimeLog,
  deleteCamStudyActiveSession,
  deleteCamStudyActiveSessionMatching,
  deleteCamStudyUser,
  findCamStudyActiveSession,
  findCamStudyTimeLog,
  findCamStudyUser,
  findWeeklyCamStudyTimeLog,
  listCamStudyActiveSessions,
  listCamStudyTimeLogs,
  listCamStudyTimeLogsBetween,
  listCamStudyUsers,
  listWeeklyCamStudyTimeLogs,
  replaceWeeklyCamStudyTimeLogs,
  upsertCamStudyUser,
  updateCamStudyActiveSession,
  updateCamStudyTimeLog,
  updateWeeklyCamStudyTimeLog,
};
