import { Op } from 'sequelize';
import { sequelize } from './config.js';
import { AttendanceLog } from './AttendanceLog.js';
import { TimeLog } from './TimeLog.js';
import { Users } from './Users.js';

const findChallengeUser = (userid: string, yearmonth: string) => Users.findOne({ where: { userid, yearmonth } });

const listChallengeUsers = (yearmonth: string) => Users.findAll({ where: { yearmonth } });

const listChallengeLogs = (yearmonthday: string) => TimeLog.findAll({ where: { yearmonthday } });

const listChallengeAttendanceLogs = (yearmonthday: string) => AttendanceLog.findAll({ where: { yearmonthday } });

const listUserChallengeLogs = (userid: string, yearmonthday: string) =>
  TimeLog.findAll({ where: { userid, yearmonthday } });

const createChallengeLog = (payload: {
  userid: string;
  username: string;
  yearmonthday: string;
  checkintime?: string | null;
  checkouttime?: string | null;
  isintime: boolean;
}) => TimeLog.create(payload);

const updateChallengeUser = (
  userid: string,
  yearmonth: string,
  values: Partial<Pick<Users, 'absencecount' | 'latecount' | 'username' | 'waketime' | 'vacances'>>,
) => Users.update(values, { where: { userid, yearmonth } });

const listMonthlySurvivors = (yearmonth: string) =>
  Users.findAll({
    where: {
      [Op.and]: [{ yearmonth }, sequelize.where(sequelize.col('absencecount'), Op.lte, sequelize.col('vacances'))],
    },
  });

export {
  createChallengeLog,
  listChallengeAttendanceLogs,
  findChallengeUser,
  listChallengeLogs,
  listChallengeUsers,
  listMonthlySurvivors,
  listUserChallengeLogs,
  updateChallengeUser,
};
