const { Events } = require('discord.js');
const { Users } = require('../repository/Users');
const { TimeLog } = require('../repository/TimeLog');
const { channelId } = require('../config.json');
const { getYearMonthDate, SUNDAY, SATURDAY, ONE_DAY_MILLISECONDS, ALARM_TIME } = require('../utils');
const logger = require('../logger');

// 알람 세팅 전까지 남은 시간 계산
const calculateRemainingTime = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(ALARM_TIME);
  target.setMinutes(0);
  target.setSeconds(0);
  target.setMilliseconds(0);

  if (now > target) {
    target.setDate(now.getDate() + 1);
  }
  logger.info(`target: ${target}`);
  logger.info(`now: ${now}`);
  logger.info(`target - now: ${target - now}`);

  return target - now;
};

const alarm = async (client) => {
  logger.info('alarm start');
  const { year, month, date, hours, minutes, day } = getYearMonthDate();
  // 공휴일 제외
  if (day === SATURDAY || day === SUNDAY) {
    return;
  }

  const channel = client.channels.cache.get(channelId);
  let string = `### ${year}${month}${date} 출석표\n`;
  const yearmonth = year + '' + month;
  const yearmonthday = yearmonth + date;
  const users = await Users.findAll({
    where: { yearmonth },
  });
  const timelogs = await TimeLog.findAll({
    where: { yearmonthday },
  });
  const userids = users.reduce((p, c) => {
    p[c.userid] = [];
    return p;
  }, {});
  const timelogsGroupById = timelogs.reduce(
    (p, timelog) => {
      p[timelog.userid]?.push(timelog);
      return p;
    }, userids);
  logger.info(`user id 로 그룹핑한 timelog 인스턴스들: `, { timelogsGroupById });

  for await (const userid of Object.keys(timelogsGroupById)) {
    const user = await Users.findOne({ where: { userid } });
    const value = timelogsGroupById[userid];
    if (value.length !== 2) {
      await Users.update({ absencecount: user.absencecount + 1 }, { where: { userid } });
      const findUser = users.find(user => userid === user.userid);
      string += `- ${findUser.username}: 결석 (${user.absencecount + 1}/${user.vacances})\n`;
      continue;
    }

    if (!value[0].isintime || !value[1].isintime) {
      await Users.update({ latecount: user.latecount + 1 }, { where: { userid } });
      string += `- ${value[0].username}: 지각 (${user.latecount + 1})\n`;
      continue;
    }
    string += `- ${value[0].username}: 출석\n`;
  }
  logger.info(`alarm final string`, { string });
  channel.send(string);
};


module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // test
    // await Users.sync({ force: true });
    // await TimeLog.sync({ force: true });

    // database synchronous
    await Users.sync();
    await TimeLog.sync();

    const remainingTime = calculateRemainingTime();
    logger.info(`remainingTime: ${remainingTime}`);
    setTimeout(() => {
      alarm(client);
      setInterval(alarm, ONE_DAY_MILLISECONDS, client);

    }, remainingTime);

    logger.info(`Ready! Logged in as ${client.user.tag}`);
  },
};