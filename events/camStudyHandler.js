const { voiceChannelId, testChannelId, logChannelId } = require('../config.json');
const { CamStudyUsers } = require('../repository/CamStudyUsers');
const { CamStudyTimeLog } = require('../repository/CamStudyTimeLog');
const { getYearMonthDate, LEAST_TIME_LIMIT } = require('../utils');
const logger = require('../logger');

/*
* 시스템은 동일하게
* 등록을 하고,
* 등록한 모든 멤버들의 하루 총 공부량을 계산하고
* 출력한다
*
* 테이블
* 1. 유저 테이블
* 2. 하루하루 공부량 계산 테이블
* */

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const wasOldStateInChannel = oldState.channelId === voiceChannelId;
    const wasOldStateVideoOn = oldState.selfVideo === true;
    const wasOldStateVideoOff = oldState.selfVideo === false;
    const isNotNewStateInChannel = newState.channelId !== voiceChannelId;
    const isNewStateInChannel = newState.channelId === voiceChannelId;
    const isNewStateVideoOff = newState.selfVideo === false;
    const isNewStateVideoOn = newState.selfVideo === true;
    const { year, month, date, hours, minutes } = getYearMonthDate();
    const yearmonthday = year + month + date;

    // 0. 등록된 회원 아니면 알람 이후 return
    const user = await CamStudyUsers.findOne({ where: { userid: newState.id } });
    if (!user) {
      if (isNewStateInChannel) {
        return await newState.channel.send('등록되지 않은 회원입니다');
      }
    }

    // console.log(oldState);
    // console.log(newState);

    const timelog = await CamStudyTimeLog.findOne({ where: { userid: newState.id, yearmonthday } });

    // newState: 공부실을 떠났을 때, oldState: 공부실 채널에 접속한 상태 && 비디오를 킨 상태
    const conditionEndWhenQuit = isNotNewStateInChannel && wasOldStateVideoOn && wasOldStateInChannel;
    // oldState: 공부실 접속한 상태 && 비디오를 킨 상태, newState: 공부실 접속한 상태 && 비디오를 끈 상태
    const conditionEndWhenTurnOff = wasOldStateInChannel && wasOldStateVideoOn && isNewStateInChannel && isNewStateVideoOff;

    // await newState.channel.send(`${user.username}님 study end: 공부시간 정상 입력안됨`);
    const logChannel = newState.guild.channels.cache.get(logChannelId);
    const voiceChannel = newState.guild.channels.cache.get(voiceChannelId);

    // 1. study end
    // 1. CamStudyTimeLog 에서 데이터를 가져온다
    // 1.1 없으면 로그 후 return
    // 2. 현재 타임스탬프를 찍는다
    // 2.1 시작 timestamp 와 차이를 계산한다
    // 2.1.1 5분 이내면 새로 timestamp를 찍는다
    // 2.2 5분 초과면 합계 칼럼을 업데이트한다
    if (conditionEndWhenTurnOff || conditionEndWhenQuit) {
      if (!timelog) {
        await logChannel.send(`${user.username}님 study end: 공부시간 정상 입력안됨`);
        await voiceChannel.send(`${user.username}님 study end: 공부시간 정상 입력안됨`);
        return;
      }

      const now = Date.now();
      const timeDiff = now - Number(timelog.timestamp);
      const timeDiffInMinutes = Math.floor(timeDiff / 1000 / 60);
      // 5분 이내 입력 안함
      if (timeDiffInMinutes < LEAST_TIME_LIMIT) {
        console.log(`now: ${now}`);
        console.log(`timeDiff: ${timeDiff}`);
        console.log(`timeDiffInMinutes: ${timeDiffInMinutes}`);
        await CamStudyTimeLog.update({ timestamp: now.toString() }, { where: { userid: newState.id, yearmonthday } });

        await voiceChannel.send(`${user.username}님 study end: 5분 이내 입력안됨`);
        await logChannel.send(`${user.username}님 study end: 5분 이내 입력안됨`);
        return;
      }

      const totalMinutes = Number(timelog.totalminutes) + timeDiffInMinutes;
      await CamStudyTimeLog.update({
        timestamp: now.toString(),
        totalminutes: totalMinutes.toString(),
      }, { where: { userid: newState.id, yearmonthday } });
      const channelLog = newState.guild.channels.cache.get(logChannelId);

      await voiceChannel.send(`${user.username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}`);
      await logChannel.send(`${user.username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}`);
    }

    // 2 study start
    // 조건: oldState: 채널에 접속한 상태 && 비디오를 끈 상태, newState: 채널에 접속한 상태 && 비디오를 킨 상태
    if (wasOldStateInChannel && wasOldStateVideoOff && isNewStateInChannel && isNewStateVideoOn) {
      // 1. CamStudyTimeLog 에서 데이터를 가져온다
      // 1.1 데이터가 없으면 새로 생성
      // 2. 공부 시작 timestamp를 찍는다
      const timestamp = Date.now().toString();
      const userid = newState.id;
      if (timelog) {
        logger.info(`userid: ${newState.id} study start => update timestamp ${timestamp}`);
        await CamStudyTimeLog.update({ timestamp }, { where: { userid, yearmonthday } });
      } else {
        await CamStudyTimeLog.create({ userid, username: user.username, yearmonthday, timestamp }, {
          where: {
            userid: newState.id,
            yearmonthday,
          },
        });
      }
      await voiceChannel.send(`${user.username}님 study start`);
      const channelLog = newState.guild.channels.cache.get(logChannelId);
      await channelLog.send(`${user.username}님 study start`);
    }
  },
};
