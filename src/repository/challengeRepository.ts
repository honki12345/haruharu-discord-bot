import { Op } from 'sequelize';
import { sequelize } from './config.js';
import { AttendanceLog } from './AttendanceLog.js';
import { ChallengeUserExclusion } from './ChallengeUserExclusion.js';
import { TimeLog } from './TimeLog.js';
import { Users } from './Users.js';
import { VacationLog } from './VacationLog.js';
import { WakeUpMembership } from './WakeUpMembership.js';
import { WaketimeChangeLog } from './WaketimeChangeLog.js';

const findChallengeUser = (userid: string, yearmonth: string) => Users.findOne({ where: { userid, yearmonth } });

const listChallengeUsers = (yearmonth: string) => Users.findAll({ where: { yearmonth } });

const findChallengeUserExclusion = (userid: string, yearmonth: string) =>
  ChallengeUserExclusion.findOne({ where: { userid, yearmonth } });

const listChallengeUserExclusions = (yearmonth: string) => ChallengeUserExclusion.findAll({ where: { yearmonth } });

const createChallengeUserExclusion = (userid: string, yearmonth: string) =>
  ChallengeUserExclusion.findOrCreate({
    where: { userid, yearmonth },
    defaults: { userid, yearmonth },
  });

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

const listWakeUpMembershipsByUserIds = (userids: string[]) =>
  WakeUpMembership.findAll({ where: { userid: { [Op.in]: userids } } });

const createWakeUpMembership = (payload: {
  userid: string;
  username: string;
  waketime: string;
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
  createChallengeUserExclusion,
  createVacationLog,
  createWakeUpMembership,
  createWaketimeChangeLog,
  listChallengeAttendanceLogs,
  findChallengeUser,
  findChallengeUserExclusion,
  findVacationLog,
  findWakeUpMembership,
  findWaketimeChangeLog,
  listChallengeUsers,
  listChallengeUserExclusions,
  listActiveWakeUpMemberships,
  listMonthlySurvivors,
  listUserChallengeLogs,
  listVacationLogs,
  listWakeUpMembershipsByUserIds,
  listMonthlyVacationLogs,
  countUserVacationLogs,
  updateChallengeUser,
  updateWakeUpMembership,
};
