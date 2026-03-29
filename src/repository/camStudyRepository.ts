import { CamStudyActiveSession } from './CamStudyActiveSession.js';
import { Op } from 'sequelize';
import { CamStudyTimeLog } from './CamStudyTimeLog.js';
import { CamStudyUsers } from './CamStudyUsers.js';
import { CamStudyWeeklyTimeLog } from './CamStudyWeeklyTimeLog.js';

const findCamStudyUser = (userid: string) => CamStudyUsers.findOne({ where: { userid } });

const listCamStudyUsers = () => CamStudyUsers.findAll();

const findCamStudyActiveSession = (userid: string) => CamStudyActiveSession.findOne({ where: { userid } });

const listCamStudyActiveSessions = () => CamStudyActiveSession.findAll();

const createCamStudyActiveSession = (payload: {
  userid: string;
  username: string;
  channelid: string;
  startedat: string;
  lastobservedat: string;
}) => CamStudyActiveSession.create(payload);

const updateCamStudyActiveSession = (
  userid: string,
  values: Partial<Pick<CamStudyActiveSession, 'channelid' | 'startedat' | 'lastobservedat' | 'username'>>,
) => CamStudyActiveSession.update(values, { where: { userid } });

const deleteCamStudyActiveSession = (userid: string) => CamStudyActiveSession.destroy({ where: { userid } });

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
  createCamStudyTimeLog,
  createWeeklyCamStudyTimeLog,
  deleteCamStudyActiveSession,
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
  updateCamStudyActiveSession,
  updateCamStudyTimeLog,
  updateWeeklyCamStudyTimeLog,
};
