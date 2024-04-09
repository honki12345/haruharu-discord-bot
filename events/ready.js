const { Events } = require('discord.js');
const { Users } = require('../repository/Users');
const { TimeLog } = require('../repository/TimeLog');
const { CamStudyUsers } = require('../repository/CamStudyUsers');
const { CamStudyTimeLog } = require('../repository/CamStudyTimeLog');
const { checkChannelId, logChannelId } = require('../config.json');
const {
  getYearMonthDate,
  calculateRemainingTimeChallenge,
  calculateWeekTimes,
  PUBLIC_HOLIDAYS_2024,
  SUNDAY,
  SATURDAY,
  ONE_DAY_MILLISECONDS,
  calculateRemainingTimeCamStudy, FRIDAY,
} = require('../utils');
const logger = require('../logger');
const { CamStudyWeeklyTimeLog } = require('../repository/CamStudyWeeklyTimeLog');

const printChallengeInterval = async (client) => {
  logger.info('print challenge start');
  const { year, month, date, day } = getYearMonthDate();
  // 주말 제외
  if (day === SATURDAY || day === SUNDAY) {
    return;
  }

  // 공휴일 제외
  const monthdate = month + date;
  if (PUBLIC_HOLIDAYS_2024.includes(monthdate)) {
    return;
  }

  const channel = client.channels.cache.get(checkChannelId);
  let string = `### ${year}${month}${date} 출석표\n`;
  let attendees = '';
  let latecomers = '';
  let absentees = '';
  const yearmonth = year + '' + month;
  const yearmonthday = yearmonth + date;
  const users = await Users.findAll({
    where: { yearmonth },
  });
  const timelogs = await TimeLog.findAll({
    where: { yearmonthday },
  });

  // TODO outer join 을 할 줄 몰라서 이렇게 처리
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

  // 출력할 string 생성
  for await (const userid of Object.keys(timelogsGroupById)) {
    const user = await Users.findOne({ where: { userid } });
    const value = timelogsGroupById[userid];
    // 결석자
    if (value.length !== 2) {
      await Users.update({ absencecount: user.absencecount + 1 }, { where: { userid } });
      const findUser = users.find(user => userid === user.userid);
      absentees += `- ${findUser.username}: 결석 (${user.absencecount + 1}/${user.vacances})\n`;
      continue;
    }

    // 지각자
    if (!value[0].isintime || !value[1].isintime) {
      await Users.update({ latecount: user.latecount + 1 }, { where: { userid } });
      latecomers += `- ${value[0].username}: 지각 (${user.latecount + 1})\n`;
      continue;
    }

    //출석자
    attendees += `- ${value[0].username}: 출석\n`;
  }
  logger.info(`alarm final string`, { string });

  (attendees) ? string += attendees : '';
  (latecomers) ? string += latecomers : '';
  (absentees) ? string += absentees : '';
  channel.send(string);
};

const printCamStudyInterval = async (client) => {
  logger.info('print cam_study start');
  const { year, month, date, day } = getYearMonthDate();

  const channel = client.channels.cache.get(logChannelId);
  let string = `### ${year}${month}${date} 타임리스트\n`;
  const yearmonthday = year + '' + month + date;
  const camStudyUsers = await CamStudyUsers.findAll();
  const camStudyTimelogs = await CamStudyTimeLog.findAll({
    where: { yearmonthday },
  });

  // daily time log update
  // TODO outer join 을 할 줄 몰라서 이렇게 처리
  const objWithName = camStudyUsers.reduce((p, c) => {
    p[c.userid] = [c.username];
    return p;
  }, {});
  const objWithNameAndMinutes = camStudyTimelogs.reduce(
    (p, timelog) => {
      if (!timelog.totalminutes) {
        p[timelog.userid]?.push(0);
        return p;
      }
      p[timelog.userid]?.push(Number(timelog.totalminutes));
      return p;
    }, objWithName);
  const timelogsGroupById = Object.entries(objWithNameAndMinutes).sort(([, [, a]], [, [, b]]) => a - b);
  logger.info(`user id 로 그룹핑한 cam-study timelog 인스턴스들: `, { timelogsGroupById });

  // daily timelog string
  // 0: userid, 1.1: username, 1.2: totalminutes
  for (const array of timelogsGroupById) {
    const username = array[1][0];
    const totalminutes = array[1][1];
    string += `- ${username}님의 공부시간: ${totalminutes}분`;
  }
  logger.info(`cam study final string`, { string });
  channel.send(string);

  // weekly time log update
  const weektimes = calculateWeekTimes();
  let weeklyString = `### ${year}${month}: ${weektimes}번째 주 타임리스트\n`;
  for await (const timelog of camStudyTimelogs) {
    const userid = timelog.userid;
    const username = timelog.username;
    const totalminutes = timelog.totalminutes;
    const weekTimeLog = await CamStudyWeeklyTimeLog.findOne({ where: { userid, weektimes } });
    if (weekTimeLog) {
      const updatedTotalminutes = weekTimeLog.totalminutes + totalminutes;
      await CamStudyWeeklyTimeLog.update({ totalminutes: updatedTotalminutes }, {
        where: {
          userid,
          weektimes,
        },
      });
      string += `- ${username}님의 공부시간: ${updatedTotalminutes}분`;
    } else {
      await CamStudyWeeklyTimeLog.create({ userid, username, weektimes, totalminutes });
      string += `- ${username}님의 공부시간: ${totalminutes}분`;
    }
  }

  if (day === FRIDAY) {
    logger.info(`cam study weekly final string`, { string });
    channel.send(weeklyString);
  }
};


module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // test
    // await Users.sync({ force: true });
    // await TimeLog.sync({ force: true });
    // await CamStudyUsers.sync({ force : true});
    // await CamStudyTimeLog.sync({force: true});

    // database synchronous
    await Users.sync();
    await TimeLog.sync();
    await CamStudyUsers.sync();
    await CamStudyTimeLog.sync();
    await CamStudyWeeklyTimeLog.sync();

    // set challenge print
    const remainingTimeChallenge = calculateRemainingTimeChallenge();
    setTimeout(() => {
      printChallengeInterval(client);
      setInterval(printChallengeInterval, ONE_DAY_MILLISECONDS, client);

    }, remainingTimeChallenge);

    // set cam_study print
    const remainingTimeCamStudy = calculateRemainingTimeCamStudy();
    setTimeout(() => {
      printCamStudyInterval(client);
      setInterval(printCamStudyInterval, ONE_DAY_MILLISECONDS, client);
    }, remainingTimeCamStudy);

    logger.info(`Ready! Logged in as ${client.user.tag}`);
  },
};