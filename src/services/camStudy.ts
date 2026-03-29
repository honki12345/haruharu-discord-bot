import { Client } from 'discord.js';
import { logger } from '../logger.js';
import {
  createCamStudyActiveSession,
  createCamStudyTimeLog,
  deleteCamStudyActiveSession,
  findCamStudyActiveSession,
  findCamStudyTimeLog,
  findCamStudyUser,
  listCamStudyActiveSessions,
  updateCamStudyActiveSession,
  updateCamStudyTimeLog,
} from '../repository/camStudyRepository.js';
import { LEAST_TIME_LIMIT } from '../utils/constants.js';
import { getFormattedYesterday, getTimeDiffFromNowInMinutes, getYearMonthDay, padTwoDigits } from '../utils/date.js';

interface VoiceStateSnapshot {
  channelId: string | null;
  selfVideo: boolean;
  streaming: boolean;
  userId: string;
}

interface CamStudyEventResult {
  target: 'channel' | 'voice-channel';
  message: string;
}

type CamStudySyncSource = 'ready' | 'heartbeat';

const isCamStudyActive = (state: Pick<VoiceStateSnapshot, 'selfVideo' | 'streaming'>) =>
  state.selfVideo || state.streaming;

const resolveCamStudyTransition = (
  oldState: VoiceStateSnapshot,
  newState: VoiceStateSnapshot,
  configuredChannelId: string,
) => {
  const wasOldStateActive = isCamStudyActive(oldState);
  const wasOldStateInChannel = oldState.channelId === configuredChannelId;
  const wasOldStateInactive = !wasOldStateActive;
  const isNewStateActive = isCamStudyActive(newState);
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

const getYearMonthDayFromTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return getYearMonthDay(date.getFullYear(), padTwoDigits(date.getMonth() + 1), padTwoDigits(date.getDate()));
};

const getDurationInMinutes = (startedAt: number, endedAt: number) => {
  const safeEndTimestamp = Math.max(startedAt, endedAt);
  return Math.floor((safeEndTimestamp - startedAt) / 1000 / 60);
};

const ensureCamStudyTimeLog = async (payload: {
  userid: string;
  username: string;
  yearmonthday: string;
  timestamp: string;
  totalminutes: number;
}) => {
  const existing = await findCamStudyTimeLog(payload.userid, payload.yearmonthday);
  if (existing) {
    await updateCamStudyTimeLog(payload.userid, payload.yearmonthday, {
      timestamp: payload.timestamp,
      totalminutes: payload.totalminutes,
    });
    return existing;
  }

  await createCamStudyTimeLog(payload);
  return null;
};

const closeActiveSession = async (
  user: { userid: string; username: string },
  activeSession: { startedat: string; lastobservedat: string; channelid: string },
  endedAt: number,
  reason: 'event-end' | 'stale-before-start' | CamStudySyncSource,
) => {
  const startedAt = Number(activeSession.startedat);
  const safeEndedAt = Math.max(startedAt, endedAt);
  const endedAtString = safeEndedAt.toString();
  const durationInMinutes = getDurationInMinutes(startedAt, safeEndedAt);
  const targetYearMonthDay = getYearMonthDayFromTimestamp(safeEndedAt);
  const timelog = await findCamStudyTimeLog(user.userid, targetYearMonthDay);
  const currentTotalMinutes = Number(timelog?.totalminutes ?? 0);

  if (durationInMinutes < LEAST_TIME_LIMIT) {
    await ensureCamStudyTimeLog({
      userid: user.userid,
      username: user.username,
      yearmonthday: targetYearMonthDay,
      timestamp: endedAtString,
      totalminutes: currentTotalMinutes,
    });
    await deleteCamStudyActiveSession(user.userid);
    logger.info('cam study active session ignored under minimum limit', {
      reason,
      userid: user.userid,
      channelId: activeSession.channelid,
      startedAt: activeSession.startedat,
      endedAt: endedAtString,
      durationInMinutes,
    });
    return { recordedMinutes: 0, totalMinutes: currentTotalMinutes, tooShort: true };
  }

  const totalMinutes = currentTotalMinutes + durationInMinutes;
  await ensureCamStudyTimeLog({
    userid: user.userid,
    username: user.username,
    yearmonthday: targetYearMonthDay,
    timestamp: endedAtString,
    totalminutes: totalMinutes,
  });
  await deleteCamStudyActiveSession(user.userid);
  logger.info('cam study active session finalized', {
    reason,
    userid: user.userid,
    channelId: activeSession.channelid,
    startedAt: activeSession.startedat,
    endedAt: endedAtString,
    durationInMinutes,
    totalMinutes,
  });

  return { recordedMinutes: durationInMinutes, totalMinutes, tooShort: false };
};

const resolveLegacyCamStudyEnd = async (
  user: { userid: string; username: string },
  oldState: VoiceStateSnapshot,
  newState: VoiceStateSnapshot,
) => {
  const today = getYearMonthDayFromTimestamp(Date.now());
  const timestampNowString = Date.now().toString();
  const timelog = await findCamStudyTimeLog(user.userid, today);

  if (!timelog) {
    const yesterday = getFormattedYesterday();
    const yesterdayTimelog = await findCamStudyTimeLog(user.userid, yesterday);
    if (yesterdayTimelog) {
      const passedMinutes = getTimeDiffFromNowInMinutes(Number(yesterdayTimelog.timestamp));
      await createCamStudyTimeLog({
        userid: user.userid,
        username: user.username,
        yearmonthday: today,
        timestamp: timestampNowString,
        totalminutes: passedMinutes,
      });

      logger.info('cam study session rolled over from yesterday', {
        passedMinutes,
        today,
        userId: user.userid,
        yesterday,
      });

      return {
        target: 'voice-channel' as const,
        message: `${user.username}님 study end: ${passedMinutes}분 입력완료, 총 공부시간: ${passedMinutes}분`,
      };
    }

    logger.warn('cam study session ended without active log', {
      newChannelId: newState.channelId,
      oldChannelId: oldState.channelId,
      userId: user.userid,
    });
    return {
      target: 'voice-channel' as const,
      message: `${user.username}님 study end: 공부시간 정상 입력안됨`,
    };
  }

  const timeDiffInMinutes = getTimeDiffFromNowInMinutes(Number(timelog.timestamp));
  if (timeDiffInMinutes < LEAST_TIME_LIMIT) {
    logger.info('cam study session ignored because duration is below limit', {
      minMinutes: LEAST_TIME_LIMIT,
      timeDiffInMinutes,
      today,
      userId: user.userid,
    });
    await updateCamStudyTimeLog(user.userid, today, { timestamp: timestampNowString });
    return {
      target: 'voice-channel' as const,
      message: `${user.username}님 study end: 5분 이내 입력안됨`,
    };
  }

  const totalMinutes = Number(timelog.totalminutes) + timeDiffInMinutes;
  await updateCamStudyTimeLog(user.userid, today, {
    timestamp: timestampNowString,
    totalminutes: totalMinutes,
  });

  logger.info('cam study session ended', {
    addedMinutes: timeDiffInMinutes,
    today,
    totalMinutes,
    userId: user.userid,
  });

  return {
    target: 'voice-channel' as const,
    message: `${user.username}님 study end: ${timeDiffInMinutes}분 입력완료, 총 공부시간: ${totalMinutes}분`,
  };
};

const startActiveSession = async (
  user: { userid: string; username: string },
  configuredChannelId: string,
  startedAt: string,
) => {
  const today = getYearMonthDayFromTimestamp(Number(startedAt));
  const timelog = await findCamStudyTimeLog(user.userid, today);

  if (timelog) {
    await updateCamStudyTimeLog(user.userid, today, { timestamp: startedAt });
  } else {
    await createCamStudyTimeLog({
      userid: user.userid,
      username: user.username,
      yearmonthday: today,
      timestamp: startedAt,
      totalminutes: 0,
    });
  }

  await createCamStudyActiveSession({
    userid: user.userid,
    username: user.username,
    channelid: configuredChannelId,
    startedat: startedAt,
    lastobservedat: startedAt,
  });

  return { hadTimeLog: Boolean(timelog), today };
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
  const user = await findCamStudyUser(newState.userId);

  if (!user) {
    if (transition.userEnteredConfiguredChannel) {
      return { target: 'channel', message: '등록되지 않은 회원입니다' };
    }
    return null;
  }

  if (transition.shouldEndByTurnOff || transition.shouldEndByQuit) {
    const activeSession = await findCamStudyActiveSession(user.userid);
    if (activeSession) {
      const result = await closeActiveSession(user, activeSession, Date.now(), 'event-end');
      if (result.tooShort) {
        return {
          target: 'voice-channel',
          message: `${user.username}님 study end: 5분 이내 입력안됨`,
        };
      }

      return {
        target: 'voice-channel',
        message: `${user.username}님 study end: ${result.recordedMinutes}분 입력완료, 총 공부시간: ${result.totalMinutes}분`,
      };
    }

    return resolveLegacyCamStudyEnd(user, oldState, newState);
  }

  if (!transition.shouldStart) {
    logger.info('cam study transition ignored', {
      newChannelId: newState.channelId,
      oldChannelId: oldState.channelId,
      today: getYearMonthDayFromTimestamp(Date.now()),
      userId: newState.userId,
    });
    return null;
  }

  const existingActiveSession = await findCamStudyActiveSession(user.userid);
  if (existingActiveSession) {
    await closeActiveSession(
      user,
      existingActiveSession,
      Number(existingActiveSession.lastobservedat),
      'stale-before-start',
    );
  }

  const timestampNowString = Date.now().toString();
  const { hadTimeLog, today } = await startActiveSession(user, configuredChannelId, timestampNowString);

  logger.info(hadTimeLog ? 'cam study session restarted' : 'cam study session started', {
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

const reconcileCamStudyActiveSessions = async (
  liveStates: VoiceStateSnapshot[],
  configuredChannelId: string,
  source: CamStudySyncSource,
) => {
  const timestampNowString = Date.now().toString();
  const activeLiveStateByUserId = new Map(
    liveStates
      .filter(liveState => liveState.channelId === configuredChannelId && isCamStudyActive(liveState))
      .map(liveState => [liveState.userId, liveState]),
  );
  const activeSessions = await listCamStudyActiveSessions();

  for (const activeSession of activeSessions) {
    const liveState = activeLiveStateByUserId.get(activeSession.userid);
    if (liveState) {
      await updateCamStudyActiveSession(activeSession.userid, {
        channelid: configuredChannelId,
        lastobservedat: timestampNowString,
      });
      activeLiveStateByUserId.delete(activeSession.userid);
      logger.info('cam study active session confirmed from voice state sync', {
        source,
        userid: activeSession.userid,
        channelId: configuredChannelId,
      });
      continue;
    }

    const user = await findCamStudyUser(activeSession.userid);
    if (!user) {
      await deleteCamStudyActiveSession(activeSession.userid);
      logger.warn('dropping cam study active session for unregistered user during sync', {
        source,
        userid: activeSession.userid,
        channelId: activeSession.channelid,
      });
      continue;
    }

    await closeActiveSession(user, activeSession, Number(activeSession.lastobservedat), source);
  }

  for (const [userid] of activeLiveStateByUserId) {
    const user = await findCamStudyUser(userid);
    if (!user) {
      logger.info('ignoring live cam study state for unregistered user during sync', {
        source,
        userid,
        channelId: configuredChannelId,
      });
      continue;
    }

    const existingActiveSession = await findCamStudyActiveSession(userid);
    if (existingActiveSession) {
      await updateCamStudyActiveSession(userid, {
        channelid: configuredChannelId,
        lastobservedat: timestampNowString,
      });
      continue;
    }

    await createCamStudyActiveSession({
      userid: user.userid,
      username: user.username,
      channelid: configuredChannelId,
      startedat: timestampNowString,
      lastobservedat: timestampNowString,
    });
    logger.info('recovered cam study active session from voice state sync', {
      source,
      userid: user.userid,
      channelId: configuredChannelId,
      recoveredAt: timestampNowString,
    });
  }
};

const extractLiveCamStudySnapshots = async (
  client: Client,
  configuredChannelId: string,
): Promise<VoiceStateSnapshot[]> => {
  const cachedChannel = client.channels.cache.get(configuredChannelId);
  const fetchedChannel =
    cachedChannel ??
    (typeof client.channels.fetch === 'function' ? await client.channels.fetch(configuredChannelId) : null);
  const members = (
    fetchedChannel as {
      members?: {
        values: () => IterableIterator<{
          id: string;
          voice: { channelId: string | null; selfVideo?: boolean; streaming: boolean };
        }>;
      };
    } | null
  )?.members;

  if (!members || typeof members.values !== 'function') {
    logger.warn('cam study sync skipped because configured voice channel is unavailable', {
      channelId: configuredChannelId,
    });
    return [];
  }

  return Array.from(members.values()).map(member => ({
    channelId: member.voice.channelId,
    selfVideo: member.voice.selfVideo === true,
    streaming: member.voice.streaming === true,
    userId: member.id,
  }));
};

const syncCamStudyActiveSessionsFromClient = async (
  client: Client,
  configuredChannelId: string,
  source: CamStudySyncSource,
) => {
  const liveStates = await extractLiveCamStudySnapshots(client, configuredChannelId);
  await reconcileCamStudyActiveSessions(liveStates, configuredChannelId, source);
};

export { processCamStudyStateChange, reconcileCamStudyActiveSessions, syncCamStudyActiveSessionsFromClient };
export type { CamStudySyncSource, VoiceStateSnapshot };
