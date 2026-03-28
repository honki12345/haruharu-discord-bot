import { logger } from '../logger.js';
import {
  createCamStudyTimeLog,
  findCamStudyTimeLog,
  findCamStudyUser,
  updateCamStudyTimeLog,
} from '../repository/camStudyRepository.js';
import { LEAST_TIME_LIMIT } from '../utils/constants.js';
import {
  getFormattedYesterday,
  getTimeDiffFromNowInMinutes,
  getYearMonthDay,
  getYearMonthDate,
} from '../utils/date.js';

interface VoiceStateSnapshot {
  channelId: string | null;
  streaming: boolean;
  userId: string;
}

interface CamStudyEventResult {
  target: 'channel' | 'voice-channel';
  message: string;
}

const resolveCamStudyTransition = (
  oldState: VoiceStateSnapshot,
  newState: VoiceStateSnapshot,
  configuredChannelId: string,
) => {
  const wasOldStateInChannel = oldState.channelId === configuredChannelId;
  const wasOldStateVideoOn = oldState.streaming;
  const wasOldStateVideoOff = !oldState.streaming;
  const isNotNewStateInChannel = newState.channelId !== configuredChannelId;
  const isNewStateInChannel = newState.channelId === configuredChannelId;
  const isNewStateVideoOff = !newState.streaming;
  const isNewStateVideoOn = newState.streaming;

  return {
    shouldEndByQuit: isNotNewStateInChannel && wasOldStateVideoOn && wasOldStateInChannel,
    shouldEndByTurnOff: wasOldStateInChannel && wasOldStateVideoOn && isNewStateInChannel && isNewStateVideoOff,
    shouldStart: wasOldStateInChannel && wasOldStateVideoOff && isNewStateInChannel && isNewStateVideoOn,
    userEnteredConfiguredChannel: isNewStateInChannel,
  };
};

const processCamStudyStateChange = async (
  oldState: VoiceStateSnapshot,
  newState: VoiceStateSnapshot,
  configuredChannelId: string,
): Promise<CamStudyEventResult | null> => {
  const transition = resolveCamStudyTransition(oldState, newState, configuredChannelId);
  const user = await findCamStudyUser(newState.userId);

  if (!user) {
    if (transition.userEnteredConfiguredChannel) {
      return { target: 'channel', message: '등록되지 않은 회원입니다' };
    }
    return null;
  }

  const { year, month, date } = getYearMonthDate();
  const today = getYearMonthDay(year, month, date);
  const timestampNowString = Date.now().toString();
  const timelog = await findCamStudyTimeLog(user.userid, today);

  if (transition.shouldEndByTurnOff || transition.shouldEndByQuit) {
    if (!timelog) {
      const yesterdayTimelog = await findCamStudyTimeLog(user.userid, getFormattedYesterday());
      if (yesterdayTimelog) {
        const passedMinutes = getTimeDiffFromNowInMinutes(Number(yesterdayTimelog.timestamp));
        await createCamStudyTimeLog({
          userid: user.userid,
          username: user.username,
          yearmonthday: today,
          timestamp: timestampNowString,
          totalminutes: passedMinutes,
        });

        return {
          target: 'voice-channel',
          message: `${user.username}님 study end: ${passedMinutes}분 입력완료, 총 공부시간: ${passedMinutes}분`,
        };
      }

      logger.info('비정상 공부 종료', { oldState }, { newState });
      return {
        target: 'voice-channel',
        message: `${user.username}님 study end: 공부시간 정상 입력안됨`,
      };
    }

    const timeDiffInMinutes = getTimeDiffFromNowInMinutes(Number(timelog.timestamp));
    if (timeDiffInMinutes < LEAST_TIME_LIMIT) {
      logger.info(`5분 이내 입력 안함, timeDiffInMinutes: ${timeDiffInMinutes}`);
      await updateCamStudyTimeLog(user.userid, today, { timestamp: timestampNowString });
      return {
        target: 'voice-channel',
        message: `${user.username}님 study end: 5분 이내 입력안됨`,
      };
    }

    const totalMinutes = Number(timelog.totalminutes) + timeDiffInMinutes;
    await updateCamStudyTimeLog(user.userid, today, {
      timestamp: timestampNowString,
      totalminutes: totalMinutes,
    });

    return {
      target: 'voice-channel',
      message: `${user.username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}분`,
    };
  }

  if (!transition.shouldStart) {
    return null;
  }

  if (timelog) {
    logger.info(`userid: ${user.userid} study start => update timestamp ${timestampNowString}`);
    await updateCamStudyTimeLog(user.userid, today, { timestamp: timestampNowString });
  } else {
    await createCamStudyTimeLog({
      userid: user.userid,
      username: user.username,
      yearmonthday: today,
      timestamp: timestampNowString,
      totalminutes: 0,
    });
  }

  return {
    target: 'voice-channel',
    message: `${user.username}님 study start`,
  };
};

export { processCamStudyStateChange };
export type { VoiceStateSnapshot };
