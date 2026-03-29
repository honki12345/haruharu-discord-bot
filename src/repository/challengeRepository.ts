import { Op } from 'sequelize';
import { sequelize } from './config.js';
import { AttendanceLog } from './AttendanceLog.js';
import { TimeLog } from './TimeLog.js';
import { Users } from './Users.js';
import { VacationLog } from './VacationLog.js';
import { WakeUpMembership } from './WakeUpMembership.js';
import { WaketimeChangeLog } from './WaketimeChangeLog.js';

const findChallengeUser = (userid: string, yearmonth: string) => Users.findOne({ where: { userid, yearmonth } });

const listChallengeUsers = (yearmonth: string) => Users.findAll({ where: { yearmonth } });

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

const findVacationLog = (userid: string, yearmonthday: string) =>
  VacationLog.findOne({ where: { userid, yearmonthday } });

const listVacationLogs = (yearmonthday: string) => VacationLog.findAll({ where: { yearmonthday } });

const listMonthlyVacationLogs = (yearmonth: string) =>
  VacationLog.findAll({ where: { yearmonthday: { [Op.like]: `${yearmonth}%` } } });

const countUserVacationLogs = (userid: string, yearmonth: string) =>
  VacationLog.count({ where: { userid, yearmonthday: { [Op.like]: `${yearmonth}%` } } });

const createVacationLog = (payload: { userid: string; username: string; yearmonthday: string }) =>
  VacationLog.create(payload);

const findWaketimeChangeLog = (userid: string, yearmonthday: string) =>
  WaketimeChangeLog.findOne({ where: { userid, yearmonthday } });

const createWaketimeChangeLog = (payload: { userid: string; yearmonthday: string; waketime: string }) =>
  WaketimeChangeLog.create(payload);

const findWakeUpMembership = (userid: string) => WakeUpMembership.findOne({ where: { userid } });

const listActiveWakeUpMemberships = () => WakeUpMembership.findAll({ where: { status: 'active' } });

const createWakeUpMembership = (payload: {
  userid: string;
  username: string;
  waketime: string | null;
  status: 'active' | 'stopped';
  stoppedat?: string | null;
}) => WakeUpMembership.create(payload);

const updateWakeUpMembership = (
  userid: string,
  values: Partial<Pick<WakeUpMembership, 'status' | 'stoppedat' | 'username' | 'waketime'>>,
) => WakeUpMembership.update(values, { where: { userid } });

const listMonthlySurvivors = (yearmonth: string) =>
  Users.findAll({
    where: {
      [Op.and]: [{ yearmonth }, sequelize.where(sequelize.col('absencecount'), Op.lte, sequelize.col('vacances'))],
    },
  });

export {
  createChallengeLog,
  createVacationLog,
  createWakeUpMembership,
  createWaketimeChangeLog,
  listChallengeAttendanceLogs,
  findChallengeUser,
  findVacationLog,
  findWakeUpMembership,
  findWaketimeChangeLog,
  listChallengeUsers,
  listActiveWakeUpMemberships,
  listMonthlySurvivors,
  listUserChallengeLogs,
  listVacationLogs,
  listMonthlyVacationLogs,
  countUserVacationLogs,
  updateChallengeUser,
  updateWakeUpMembership,
};
