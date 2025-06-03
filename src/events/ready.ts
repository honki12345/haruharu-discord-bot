import { Client, Events } from 'discord.js';
import { Users } from '../repository/Users.js';
import { TimeLog } from '../repository/TimeLog.js';
import { CamStudyUsers } from '../repository/CamStudyUsers.js';
import { CamStudyTimeLog } from '../repository/CamStudyTimeLog.js';
import { CamStudyWeeklyTimeLog } from '../repository/CamStudyWeeklyTimeLog.js';
import { createRequire } from 'node:module';
import { logger } from '../logger.js';
import {
  getYearMonthDate,
  calculateRemainingTimeChallenge,
  calculateWeekTimes,
  calculateRemainingTimeCamStudy,
  formatFromMinutesToHours,
  isLastDayOfMonth,
  PUBLIC_HOLIDAYS_2025,
  SUNDAY,
  SATURDAY,
  ONE_DAY_MILLISECONDS,
} from '../utils.js';
import { Op } from 'sequelize';
import { sequelize } from '../repository/config.js';

const jsonRequire = createRequire(import.meta.url);
const { checkChannelId, logChannelId, resultChannelId } = jsonRequire('../../config.json');


const printChallengeInterval = async (client: Client) => {
  logger.info('print challenge start');
  const { year, month, date, day } = getYearMonthDate();

  // 월말 명예의 전당
  if (isLastDayOfMonth(Number(year), Number(month), Number(date))) {
    const yearmonth = year + '' + month;
    const channel = client.channels.cache.get(resultChannelId);
    const users = await Users.findAll({
      where: {
        yearmonth,
        absencecount: {
          [Op.lte]: sequelize.col('vacances'),
        },
      },
    });
    let string = `### ${year}${month} 생존명단\n`;
    users.forEach((user) => {
      string += `- ${user.username}\n`;
    })
    if (channel && 'send' in channel) {
      await channel.send(string);
    }
  }

  // 주말 제외
  if (day === SATURDAY || day === SUNDAY) {
    return;
  }

  // 공휴일 제외
  const monthdate = month + date;
  if (PUBLIC_HOLIDAYS_2025.includes(monthdate)) {
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
  const userids = users.reduce<{ [index: string]: TimeLog[] }>((p, c) => {
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
    const user = await Users.findOne({ where: { userid, yearmonth } });
    if (user === null) {
      continue;
    }
    const value = timelogsGroupById[userid];
    // 결석자
    if (value.length !== 2) {
      await Users.update({ absencecount: user.absencecount + 1 }, { where: { userid, yearmonth } });
      const findUser = users.find(user => userid === user.userid);
      if (findUser) {
        absentees += `- ${findUser.username}: 결석 (${user.absencecount + 1}/${user.vacances})\n`;
      }
      continue;
    }

    // 지각자
    if (!value[0].isintime || !value[1].isintime) {
      await Users.update({ latecount: user.latecount + 1 }, { where: { userid, yearmonth } });
      latecomers += `- ${value[0].username}: 지각 (${user.latecount + 1})\n`;
      continue;
    }

    //출석자
    attendees += `- ${value[0].username}: 출석\n`;
  }

  (attendees) ? string += attendees : '';
  (latecomers) ? string += latecomers : '';
  (absentees) ? string += absentees : '';
  logger.info(`alarm final string`, { string });
  if (channel && 'send' in channel) {
    await channel.send(string);
  }

};

const printCamStudyInterval = async (client: Client) => {
  logger.info('print cam_study start');
  const { year, month, date } = getYearMonthDate();

  const channel = client.channels.cache.get(logChannelId);
  let dailyTotalString = `### 일일 타임리스트 (${year}${month}${date})\n`;
  const yearmonthday = year + '' + month + date;
  const camStudyUsers = await CamStudyUsers.findAll();
  const camStudyTimelogs = await CamStudyTimeLog.findAll({
    where: { yearmonthday },
  });

  // daily time log update
  // TODO outer join 을 할 줄 몰라서 이렇게 처리: 결과적으로 복잡도가 올라가버렸다
  const objWithName = camStudyUsers.reduce<{ [index: string]: [string, number] }>((p, c) => {
    p[c.userid] = [c.username, 0];
    return p;
  }, {});
  const objWithNameAndMinutes = camStudyTimelogs.reduce(
    (p, timelog) => {
      if (!timelog.totalminutes) {
        return p;
      }
      if (Array.isArray(p[timelog.userid])) {
        p[timelog.userid][1] = Number(timelog.totalminutes);
      }
      return p;
    }, objWithName);
  // totalminutes 기준으로 내림차순
  const timelogsGroupById = Object.entries(objWithNameAndMinutes).sort(([, [, a]], [, [, b]]) => b - a);
  logger.info(`user id 로 그룹핑한 cam-study timelog 인스턴스들: `, { timelogsGroupById });

  // daily timelog string generator
  // array => 0: userid, 1.1: username, 1.2: totalminutes
  for (const array of timelogsGroupById) {
    const username = array[1][0];
    let totalminutes = array[1][1];
    dailyTotalString += `- ${username}님의 공부시간: ${formatFromMinutesToHours(Number(totalminutes))}\n`;
  }
  logger.info(`cam study final string`, { string: dailyTotalString });
  if (channel && 'send' in channel) {
    await channel.send(dailyTotalString);
  }

  // ######## weekly logic start
  // weekly time log update
  const weektimes = calculateWeekTimes();
  for await (const timelog of camStudyTimelogs) {
    const userid = timelog.userid;
    const username = timelog.username;
    const totalminutes = Number(timelog.totalminutes);
    const weekTimeLog = await CamStudyWeeklyTimeLog.findOne({ where: { userid, weektimes } });
    if (weekTimeLog) {
      const updatedTotalminutes = Number(weekTimeLog.totalminutes) + totalminutes;
      await CamStudyWeeklyTimeLog.update({ totalminutes: updatedTotalminutes }, {
        where: {
          userid,
          weektimes,
        },
      });
    } else {
      await CamStudyWeeklyTimeLog.create({ userid, username, weektimes, totalminutes });
    }
  }


  // weekly time log string generator
  let weeklyString = `### 주간 타임리스트 (${year}${month}: ${weektimes}번째 주)\n`;
  const weeklyTimeLogs = await CamStudyWeeklyTimeLog.findAll({
    where: { weektimes },
    order: [
      ['totalminutes', 'DESC'],
    ],
  });
  for (const weeklyTimeLog of weeklyTimeLogs) {
    weeklyString += `- ${weeklyTimeLog.username}님의 공부시간: ${formatFromMinutesToHours(Number(weeklyTimeLog.totalminutes))}\n`;
  }

  logger.info(`cam study weekly final string`, { weeklyString });
  if (channel && 'send' in channel) {
    channel.send(weeklyString);
  }
};


export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
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

    logger.info(`Ready! Logged in as ${client.user?.tag}`);
  },
};