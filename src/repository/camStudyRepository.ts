import { Op } from 'sequelize';
import { CamStudyTimeLog } from './CamStudyTimeLog.js';
import { CamStudyUsers } from './CamStudyUsers.js';
import { CamStudyWeeklyTimeLog } from './CamStudyWeeklyTimeLog.js';

const findCamStudyUser = (userid: string) => CamStudyUsers.findOne({ where: { userid } });

const listCamStudyUsers = () => CamStudyUsers.findAll();

const camStudyUserMutationLocks = new Map<string, Promise<void>>();

const withCamStudyUserMutationLock = async <T>(userid: string, task: () => Promise<T>) => {
  const previousLock = camStudyUserMutationLocks.get(userid) ?? Promise.resolve();
  let releaseCurrentLock!: () => void;
  const currentLock = new Promise<void>(resolve => {
    releaseCurrentLock = resolve;
  });
  const queuedLock = previousLock.then(() => currentLock);

  camStudyUserMutationLocks.set(userid, queuedLock);
  await previousLock;

  try {
    return await task();
  } finally {
    releaseCurrentLock();

    if (camStudyUserMutationLocks.get(userid) === queuedLock) {
      camStudyUserMutationLocks.delete(userid);
    }
  }
};

const upsertCamStudyUser = async (payload: { userid: string; username: string }) => {
  const sequelize = CamStudyUsers.sequelize;
  if (!sequelize) {
    throw new Error('CamStudyUsers sequelize instance is not initialized');
  }

  return withCamStudyUserMutationLock(payload.userid, async () =>
    sequelize.transaction(async transaction => {
      const existingUsers = await CamStudyUsers.findAll({
        where: { userid: payload.userid },
        order: [['id', 'ASC']],
        transaction,
      });

      if (!existingUsers.length) {
        return CamStudyUsers.create(payload, { transaction });
      }

      const [primaryUser, ...duplicateUsers] = existingUsers;
      if (primaryUser.username !== payload.username) {
        primaryUser.username = payload.username;
        await primaryUser.save({ transaction });
      }

      if (duplicateUsers.length) {
        await CamStudyUsers.destroy({
          where: {
            id: {
              [Op.in]: duplicateUsers.map(user => user.id),
            },
          },
          transaction,
        });
      }

      return primaryUser;
    }),
  );
};

const removeCamStudyUser = (userid: string) =>
  withCamStudyUserMutationLock(userid, () => CamStudyUsers.destroy({ where: { userid } }));

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
  createCamStudyTimeLog,
  createWeeklyCamStudyTimeLog,
  findCamStudyTimeLog,
  findCamStudyUser,
  findWeeklyCamStudyTimeLog,
  listCamStudyTimeLogs,
  listCamStudyTimeLogsBetween,
  listCamStudyUsers,
  listWeeklyCamStudyTimeLogs,
  removeCamStudyUser,
  replaceWeeklyCamStudyTimeLogs,
  upsertCamStudyUser,
  updateCamStudyTimeLog,
  updateWeeklyCamStudyTimeLog,
};
