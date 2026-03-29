import { logger } from '../logger.js';
import {
  createCamStudyTimeLog,
  findCamStudyTimeLog,
  findCamStudyUser,
  removeCamStudyUser,
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
  hasCamStudyRole?: boolean | null;
  selfVideo: boolean;
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
  const wasOldStateActive = oldState.selfVideo || oldState.streaming;
  const wasOldStateInChannel = oldState.channelId === configuredChannelId;
  const wasOldStateInactive = !wasOldStateActive;
  const isNewStateActive = newState.selfVideo || newState.streaming;
  const isNotNewStateInChannel = newState.channelId !== configuredChannelId;
  const isNewStateInChannel = newState.channelId === configuredChannelId;
  const isNewStateInactive = !isNewStateActive;

  return {
    isNewStateActive,
    wasOldStateActive,
    shouldEndByQuit: isNotNewStateInChannel && wasOldStateActive && wasOldStateInChannel,
    shouldEndByTurnOff: wasOldStateInChannel && wasOldStateActive && isNewStateInChannel && isNewStateInactive,
    shouldStart: isNewStateInChannel && isNewStateActive && (!wasOldStateInChannel || wasOldStateInactive),
    userEnteredConfiguredChannel: isNewStateInChannel,
    wasOldStateInChannel,
  };
};

const processCamStudyStateChange = async (
  oldState: VoiceStateSnapshot,
  newState: VoiceStateSnapshot,
  configuredChannelId: string,
): Promise<CamStudyEventResult | null> => {
  const transition = resolveCamStudyTransition(oldState, newState, configuredChannelId);
  logger.info('cam study transition evaluated', {
    newChannelId: newState.channelId,
    newSelfVideo: newState.selfVideo,
    newStreaming: newState.streaming,
    oldChannelId: oldState.channelId,
    oldSelfVideo: oldState.selfVideo,
    oldStreaming: oldState.streaming,
    shouldEndByQuit: transition.shouldEndByQuit,
    shouldEndByTurnOff: transition.shouldEndByTurnOff,
    shouldStart: transition.shouldStart,
    userId: newState.userId,
  });

  const { year, month, date } = getYearMonthDate();
  const today = getYearMonthDay(year, month, date);
  const timestampNowString = Date.now().toString();
  const timelog = await findCamStudyTimeLog(newState.userId, today);
  const user = await findCamStudyUser(newState.userId);
  const shouldRemoveUserAfterEnd = oldState.hasCamStudyRole === false || newState.hasCamStudyRole === false;

  if (!user) {
    if (transition.userEnteredConfiguredChannel) {
      return { target: 'channel', message: '등록되지 않은 회원입니다' };
    }
    return null;
  }

  if (transition.shouldEndByTurnOff || transition.shouldEndByQuit) {
    if (!timelog) {
      const yesterdayTimelog = await findCamStudyTimeLog(newState.userId, getFormattedYesterday());
      if (yesterdayTimelog) {
        const passedMinutes = getTimeDiffFromNowInMinutes(Number(yesterdayTimelog.timestamp));
        await createCamStudyTimeLog({
          userid: yesterdayTimelog.userid,
          username: yesterdayTimelog.username,
          yearmonthday: today,
          timestamp: timestampNowString,
          totalminutes: passedMinutes,
        });

        logger.info('cam study session rolled over from yesterday', {
          passedMinutes,
          today,
          userId: yesterdayTimelog.userid,
          yesterday: getFormattedYesterday(),
        });

        if (shouldRemoveUserAfterEnd) {
          await removeCamStudyUser(user.userid);
        }

        return {
          target: 'voice-channel',
          message: `${yesterdayTimelog.username}님 study end: ${passedMinutes}분 입력완료, 총 공부시간: ${passedMinutes}분`,
        };
      }

      logger.warn('cam study session ended without active log', {
        newChannelId: newState.channelId,
        oldChannelId: oldState.channelId,
        userId: user.userid,
      });

      if (shouldRemoveUserAfterEnd) {
        await removeCamStudyUser(user.userid);
      }

      return {
        target: 'voice-channel',
        message: `${user.username}님 study end: 공부시간 정상 입력안됨`,
      };
    }

    const timeDiffInMinutes = getTimeDiffFromNowInMinutes(Number(timelog.timestamp));
    if (timeDiffInMinutes < LEAST_TIME_LIMIT) {
      logger.info('cam study session ignored because duration is below limit', {
        minMinutes: LEAST_TIME_LIMIT,
        timeDiffInMinutes,
        today,
        userId: timelog.userid,
      });
      await updateCamStudyTimeLog(timelog.userid, today, { timestamp: timestampNowString });

      if (shouldRemoveUserAfterEnd) {
        await removeCamStudyUser(user.userid);
      }

      return {
        target: 'voice-channel',
        message: `${timelog.username}님 study end: 5분 이내 입력안됨`,
      };
    }

    const totalMinutes = Number(timelog.totalminutes) + timeDiffInMinutes;
    await updateCamStudyTimeLog(timelog.userid, today, {
      timestamp: timestampNowString,
      totalminutes: totalMinutes,
    });

    if (shouldRemoveUserAfterEnd) {
      await removeCamStudyUser(user.userid);
    }

    logger.info('cam study session ended', {
      addedMinutes: timeDiffInMinutes,
      today,
      totalMinutes,
      userId: timelog.userid,
    });

    return {
      target: 'voice-channel',
      message: `${timelog.username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}분`,
    };
  }

  if (!transition.shouldStart) {
    logger.info('cam study transition ignored', {
      newChannelId: newState.channelId,
      oldChannelId: oldState.channelId,
      today,
      userId: newState.userId,
    });
    return null;
  }

  if (newState.hasCamStudyRole === false) {
    return null;
  }

  if (timelog) {
    logger.info('cam study session restarted', {
      timestamp: timestampNowString,
      today,
      userId: user.userid,
    });
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

  logger.info('cam study session started', {
    isNewStateActive: transition.isNewStateActive,
    timestamp: timestampNowString,
    today,
    userId: user.userid,
    wasOldStateActive: transition.wasOldStateActive,
    wasOldStateInChannel: transition.wasOldStateInChannel,
  });

  return {
    target: 'voice-channel',
    message: `${user.username}님 study start`,
  };
};

export { processCamStudyStateChange };
export type { VoiceStateSnapshot };
