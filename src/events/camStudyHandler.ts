import { createRequire } from 'node:module';
import { CamStudyUsers } from '../repository/CamStudyUsers.js';
import { CamStudyTimeLog } from '../repository/CamStudyTimeLog.js';
import { getYearMonthDate, getFormattedYesterday, getTimeDiffFromNowInMinutes, LEAST_TIME_LIMIT } from '../utils.js';
import { logger } from '../logger.js';
import { VoiceState } from 'discord.js';

const jsonRequire = createRequire(import.meta.url);
const { voiceChannelId, logChannelId } = jsonRequire('../../config.json');

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

export const event = {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    const wasOldStateInChannel = oldState.channelId === voiceChannelId;
    const wasOldStateVideoOn = oldState.selfVideo === true;
    const wasOldStateVideoOff = oldState.selfVideo === false;
    const isNotNewStateInChannel = newState.channelId !== voiceChannelId;
    const isNewStateInChannel = newState.channelId === voiceChannelId;
    const isNewStateVideoOff = newState.selfVideo === false;
    const isNewStateVideoOn = newState.selfVideo === true;
    // newState: 공부실을 떠났을 때, oldState: 공부실 채널에 접속한 상태 && 비디오를 킨 상태
    const conditionEndWhenQuit = isNotNewStateInChannel && wasOldStateVideoOn && wasOldStateInChannel;
    // oldState: 공부실 접속한 상태 && 비디오를 킨 상태, newState: 공부실 접속한 상태 && 비디오를 끈 상태
    const conditionEndWhenTurnOff = wasOldStateInChannel && wasOldStateVideoOn && isNewStateInChannel && isNewStateVideoOff;

    const { year, month, date } = getYearMonthDate();
    const today = year + month + date;  // yyyymmdd
    const timestampNowString = Date.now().toString();

    const logChannel = newState.guild.channels.cache.get(logChannelId);
    const voiceChannel = newState.guild.channels.cache.get(voiceChannelId);

    // 0. 등록된 회원 아니면 알람 이후 return
    const user = await CamStudyUsers.findOne({ where: { userid: newState.id } });
    if (!user) {
      if (isNewStateInChannel) {
        return await newState.channel?.send('등록되지 않은 회원입니다');
      }
    }

    const { userid, username } = user!;

    // console.log(oldState);
    // console.log(newState);

    const timelog = await CamStudyTimeLog.findOne({ where: { userid, yearmonthday: today } });

    // await newState.channel.send(`${user.username}님 study end: 공부시간 정상 입력안됨`);

    // 1. study end
    // 1. CamStudyTimeLog 에서 데이터를 가져온다
    // 1.1 없으면 로그 후 return
    // 2. 현재 타임스탬프를 찍는다
    // 2.1 시작 timestamp 와 차이를 계산한다
    // 2.1.1 5분 이내면 새로 timestamp를 찍는다
    // 2.2 5분 초과면 합계 칼럼을 업데이트한다
    if (conditionEndWhenTurnOff || conditionEndWhenQuit) {
      if (!timelog) {
        const yesterday = getFormattedYesterday();
        // 1.어제 날짜의 timelog 가 있는지 확인
        const yesterdayTimelog = await CamStudyTimeLog.findOne({
          where: {
            userid,
            yearmonthday: yesterday,
          },
        });
        // 1.1 어제 날짜의 timelog 가 있다면 새로운 timelog 를 생성하고 거기에 타임을 주입
        if (yesterdayTimelog) {
          const passedMinutes = getTimeDiffFromNowInMinutes(Number(yesterdayTimelog.timestamp));
          await CamStudyTimeLog.create({
            userid,
            username,
            yearmonthday: today,
            timestamp: timestampNowString,
            totalminutes: passedMinutes,
          });
          if (voiceChannel && 'send' in voiceChannel) {
            await voiceChannel.send(`${username}님 study end: ${passedMinutes}분 입력완료, 총 공부시간: ${passedMinutes}분`);
          }
          if (logChannel && 'send' in logChannel) {
            await logChannel.send(`${username}님 study end: ${passedMinutes}분 입력완료, 총 공부시간: ${passedMinutes}분`);
          }
          return;
        }

        // 1.2 없다면 비정상 공부종료
        logger.info('비정상 공부 종료', { oldState }, { newState });
        if (logChannel && 'send' in logChannel) {
          await logChannel.send(`${username}님 study end: 공부시간 정상 입력안됨`);
        }
        if (voiceChannel && 'send' in voiceChannel) {
          await voiceChannel.send(`${username}님 study end: 공부시간 정상 입력안됨`);
        }
        return;
      }

      const timeDiffInMinutes = getTimeDiffFromNowInMinutes(Number(timelog.timestamp));
      // 5분 이내 입력 안함
      if (timeDiffInMinutes < LEAST_TIME_LIMIT) {
        logger.info(`5분 이내 입력 안함, timeDiffInMinutes: ${timeDiffInMinutes}`);
        await CamStudyTimeLog.update({ timestamp: timestampNowString }, {
          where: {
            userid,
            yearmonthday: today,
          },
        });

        if (voiceChannel && 'send' in voiceChannel) {
          await voiceChannel.send(`${username}님 study end: 5분 이내 입력안됨`);
        }
        if (logChannel && 'send' in logChannel) {
          await logChannel.send(`${username}님 study end: 5분 이내 입력안됨`);
        }
        return;
      }

      const totalMinutes = Number(timelog.totalminutes) + timeDiffInMinutes;
      await CamStudyTimeLog.update({
        timestamp: timestampNowString,
        totalminutes: totalMinutes,
      }, { where: { userid, yearmonthday: today } });

      if (voiceChannel && 'send' in voiceChannel) {
        await voiceChannel.send(`${username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}분`);
      }
      if (logChannel && 'send' in logChannel) {
        await logChannel.send(`${username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}분`);
      }
    }

    // 2 study start
    // 조건: oldState: 채널에 접속한 상태 && 비디오를 끈 상태, newState: 채널에 접속한 상태 && 비디오를 킨 상태
    if (wasOldStateInChannel && wasOldStateVideoOff && isNewStateInChannel && isNewStateVideoOn) {
      // 1. CamStudyTimeLog 에서 데이터를 가져온다
      // 1.1 데이터가 없으면 새로 생성
      // 2. 공부 시작 timestamp를 찍는다
      if (timelog) {
        logger.info(`userid: ${userid} study start => update timestamp ${timestampNowString}`);
        await CamStudyTimeLog.update({ timestamp: timestampNowString }, { where: { userid, yearmonthday: today } });
      } else {
        await CamStudyTimeLog.create({
          userid,
          username,
          totalminutes: 0,
          yearmonthday: today,
          timestamp: timestampNowString,
        });
      }
      if (voiceChannel && 'send' in voiceChannel) {
        await voiceChannel.send(`${username}님 study start`);
      }
      const channelLog = newState.guild.channels.cache.get(logChannelId);
      if (channelLog && 'send' in channelLog) {
        await channelLog.send(`${username}님 study start`);
      }
    }
  },
};
