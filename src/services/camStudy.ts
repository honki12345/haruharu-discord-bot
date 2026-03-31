import { Client } from 'discord.js';
import { logger } from '../logger.js';
import {
  createOrRefreshCamStudyActiveSession,
  createCamStudyTimeLog,
  deleteCamStudyActiveSession,
  deleteCamStudyActiveSessionMatching,
  findCamStudyActiveSession,
  findCamStudyTimeLog,
  findCamStudyUser,
  listCamStudyActiveSessions,
  removeCamStudyUser,
  updateCamStudyActiveSession,
  updateCamStudyTimeLog,
} from '../repository/camStudyRepository.js';
import { LEAST_TIME_LIMIT } from '../utils/constants.js';
import { getFormattedYesterday, getYearMonthDay, padTwoDigits } from '../utils/date.js';

interface VoiceStateSnapshot {
  channelId: string | null;
  hasCamStudyRole?: boolean | null;
  selfVideo: boolean;
  streaming: boolean;
  userId: string;
}

interface CamStudyEventResult {
  delivery: 'participant';
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

const getStartOfNextDayTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
};

const getPreviousYearMonthDayFromTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setDate(date.getDate() - 1);
  return getYearMonthDay(date.getFullYear(), padTwoDigits(date.getMonth() + 1), padTwoDigits(date.getDate()));
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

const buildCamStudyDailySegments = (startedAt: number, endedAt: number) => {
  const safeEndedAt = Math.max(startedAt, endedAt);
  const totalRecordedMinutes = getDurationInMinutes(startedAt, safeEndedAt);
  const rawSegments: Array<{ durationMs: number; segmentEnd: number; yearmonthday: string }> = [];
  let cursor = startedAt;

  while (cursor < safeEndedAt) {
    const segmentEnd = Math.min(safeEndedAt, getStartOfNextDayTimestamp(cursor));
    rawSegments.push({
      durationMs: segmentEnd - cursor,
      segmentEnd,
      yearmonthday: getYearMonthDayFromTimestamp(cursor),
    });
    cursor = segmentEnd;
  }

  let allocatedMinutes = 0;
  const segments = rawSegments.map((segment, index) => {
    const isLastSegment = index === rawSegments.length - 1;
    const addedMinutes = isLastSegment
      ? totalRecordedMinutes - allocatedMinutes
      : Math.floor(segment.durationMs / 1000 / 60);

    allocatedMinutes += addedMinutes;
    return {
      addedMinutes,
      timestamp: segment.segmentEnd.toString(),
      yearmonthday: segment.yearmonthday,
    };
  });

  return {
    segments,
    totalRecordedMinutes,
  };
};

const finalizeCamStudyDuration = async (
  user: { userid: string; username: string },
  startedAt: number,
  endedAt: number,
  reason: 'event-end' | 'stale-before-start' | 'legacy-end' | CamStudySyncSource,
) => {
  const safeEndedAt = Math.max(startedAt, endedAt);
  const endedAtString = safeEndedAt.toString();
  const { segments, totalRecordedMinutes } = buildCamStudyDailySegments(startedAt, safeEndedAt);
  const endingYearMonthDay = segments[segments.length - 1]?.yearmonthday ?? getYearMonthDayFromTimestamp(safeEndedAt);
  const endingTimeLog = await findCamStudyTimeLog(user.userid, endingYearMonthDay);
  const currentEndingDayTotal = Number(endingTimeLog?.totalminutes ?? 0);

  if (totalRecordedMinutes < LEAST_TIME_LIMIT) {
    await ensureCamStudyTimeLog({
      userid: user.userid,
      username: user.username,
      yearmonthday: endingYearMonthDay,
      timestamp: endedAtString,
      totalminutes: currentEndingDayTotal,
    });
    logger.info('cam study session ignored under minimum limit', {
      durationInMinutes: totalRecordedMinutes,
      endedAt: endedAtString,
      reason,
      startedAt: startedAt.toString(),
      userid: user.userid,
    });
    return { recordedMinutes: 0, totalMinutes: currentEndingDayTotal, tooShort: true };
  }

  let totalMinutes = currentEndingDayTotal;
  for (const segment of segments) {
    const timelog = await findCamStudyTimeLog(user.userid, segment.yearmonthday);
    const nextTotalMinutes = Number(timelog?.totalminutes ?? 0) + segment.addedMinutes;
    await ensureCamStudyTimeLog({
      userid: user.userid,
      username: user.username,
      yearmonthday: segment.yearmonthday,
      timestamp: segment.timestamp,
      totalminutes: nextTotalMinutes,
    });
    totalMinutes = nextTotalMinutes;
  }

  logger.info('cam study session finalized', {
    durationInMinutes: totalRecordedMinutes,
    endedAt: endedAtString,
    reason,
    startedAt: startedAt.toString(),
    totalMinutes,
    userid: user.userid,
  });
  return { recordedMinutes: totalRecordedMinutes, totalMinutes, tooShort: false };
};

const claimActiveSessionForClose = async (
  userid: string,
  activeSession: { startedat: string; lastobservedat: string },
) => {
  let currentSession = activeSession;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const claimedCount = await deleteCamStudyActiveSessionMatching({
      lastobservedat: currentSession.lastobservedat,
      startedat: currentSession.startedat,
      userid,
    });
    if (claimedCount > 0) {
      return currentSession;
    }

    const latestActiveSession = await findCamStudyActiveSession(userid);
    if (!latestActiveSession) {
      return null;
    }

    if (latestActiveSession.startedat !== currentSession.startedat) {
      return null;
    }

    currentSession = latestActiveSession;
  }

  return null;
};

const closeActiveSession = async (
  user: { userid: string; username: string },
  activeSession: { startedat: string; lastobservedat: string; channelid: string },
  endedAt: number,
  reason: 'event-end' | 'stale-before-start' | CamStudySyncSource,
) => {
  const claimedSession = await claimActiveSessionForClose(user.userid, activeSession);
  if (!claimedSession) {
    logger.info('cam study active session close skipped because session was already updated or removed', {
      reason,
      userid: user.userid,
      channelId: activeSession.channelid,
      startedAt: activeSession.startedat,
      lastObservedAt: activeSession.lastobservedat,
    });
    return { recordedMinutes: 0, totalMinutes: 0, tooShort: true, skipped: true };
  }

  const effectiveEndedAt = Math.max(endedAt, Number(claimedSession.lastobservedat));
  const result = await finalizeCamStudyDuration(user, Number(claimedSession.startedat), effectiveEndedAt, reason);
  return { ...result, skipped: false };
};

const resolveLegacyCamStudyEnd = async (
  user: { userid: string; username: string },
  oldState: VoiceStateSnapshot,
  newState: VoiceStateSnapshot,
) => {
  const endedAt = Date.now();
  const today = getYearMonthDayFromTimestamp(endedAt);
  const timelog = await findCamStudyTimeLog(user.userid, today);

  if (timelog) {
    const result = await finalizeCamStudyDuration(user, Number(timelog.timestamp), endedAt, 'legacy-end');
    if (result.tooShort) {
      return {
        delivery: 'participant' as const,
        message: `${user.username}님 study end: 5분 이내 입력안됨`,
      };
    }

    return {
      delivery: 'participant' as const,
      message: `${user.username}님 study end: ${result.recordedMinutes}분 입력완료, 총 공부시간: ${result.totalMinutes}분`,
    };
  }

  const yesterday = getFormattedYesterday();
  if (getPreviousYearMonthDayFromTimestamp(endedAt) !== yesterday) {
    logger.warn('cam study session ended without active log', {
      newChannelId: newState.channelId,
      oldChannelId: oldState.channelId,
      userId: user.userid,
    });
    return {
      delivery: 'participant' as const,
      message: `${user.username}님 study end: 공부시간 정상 입력안됨`,
    };
  }

  {
    const yesterdayTimelog = await findCamStudyTimeLog(user.userid, yesterday);
    if (yesterdayTimelog) {
      const result = await finalizeCamStudyDuration(user, Number(yesterdayTimelog.timestamp), endedAt, 'legacy-end');
      if (result.tooShort) {
        return {
          delivery: 'participant' as const,
          message: `${user.username}님 study end: 5분 이내 입력안됨`,
        };
      }

      return {
        delivery: 'participant' as const,
        message: `${user.username}님 study end: ${result.recordedMinutes}분 입력완료, 총 공부시간: ${result.totalMinutes}분`,
      };
    }
  }

  return {
    delivery: 'participant' as const,
    message: `${user.username}님 study end: 공부시간 정상 입력안됨`,
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

  await createOrRefreshCamStudyActiveSession({
    userid: user.userid,
    username: user.username,
    channelid: configuredChannelId,
    startedat: startedAt,
    lastobservedat: startedAt,
  });

  return { hadTimeLog: Boolean(timelog), today };
};

const getRecoveryStartedAt = async (userid: string, recoveredAt: number) => {
  const today = getYearMonthDayFromTimestamp(recoveredAt);
  const todayLog = await findCamStudyTimeLog(userid, today);
  if (todayLog && Number(todayLog.totalminutes) === 0) {
    return todayLog.timestamp;
  }

  const yesterdayLog = await findCamStudyTimeLog(userid, getPreviousYearMonthDayFromTimestamp(recoveredAt));
  if (yesterdayLog && Number(yesterdayLog.totalminutes) === 0) {
    return yesterdayLog.timestamp;
  }

  return recoveredAt.toString();
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
  const shouldRemoveUserAfterEnd = oldState.hasCamStudyRole === false || newState.hasCamStudyRole === false;

  if (!user) {
    if (transition.userEnteredConfiguredChannel) {
      return { delivery: 'participant', message: '등록되지 않은 회원입니다' };
    }
    return null;
  }

  if (transition.shouldEndByTurnOff || transition.shouldEndByQuit) {
    const activeSession = await findCamStudyActiveSession(user.userid);
    if (activeSession) {
      const result = await closeActiveSession(user, activeSession, Date.now(), 'event-end');
      if (result.skipped) {
        return null;
      }

      if (shouldRemoveUserAfterEnd) {
        await removeCamStudyUser(user.userid);
      }

      if (result.tooShort) {
        return {
          delivery: 'participant',
          message: `${user.username}님 study end: 5분 이내 입력안됨`,
        };
      }

      return {
        delivery: 'participant',
        message: `${user.username}님 study end: ${result.recordedMinutes}분 입력완료, 총 공부시간: ${result.totalMinutes}분`,
      };
    }

    const result = await resolveLegacyCamStudyEnd(user, oldState, newState);
    if (shouldRemoveUserAfterEnd) {
      await removeCamStudyUser(user.userid);
    }
    return result;
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
    const result = await closeActiveSession(
      user,
      existingActiveSession,
      Number(existingActiveSession.lastobservedat),
      'stale-before-start',
    );
    if (result.skipped) {
      logger.info('cam study stale session close skipped before start because another path already handled it', {
        userId: user.userid,
      });
    }
  }

  if (newState.hasCamStudyRole === false) {
    return null;
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
    delivery: 'participant',
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

    const startedAt = await getRecoveryStartedAt(user.userid, Number(timestampNowString));
    const mergedSession = await createOrRefreshCamStudyActiveSession({
      userid: user.userid,
      username: user.username,
      channelid: configuredChannelId,
      startedat: startedAt,
      lastobservedat: timestampNowString,
    });
    logger.info('recovered cam study active session from voice state sync', {
      source,
      userid: user.userid,
      channelId: configuredChannelId,
      recoveredAt: timestampNowString,
      startedAt: mergedSession.startedat,
    });
  }
};

const extractLiveCamStudySnapshots = async (
  client: Client,
  configuredChannelId: string,
): Promise<VoiceStateSnapshot[] | null> => {
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
    return null;
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
  if (!liveStates) {
    return;
  }

  await reconcileCamStudyActiveSessions(liveStates, configuredChannelId, source);
};

export { processCamStudyStateChange, reconcileCamStudyActiveSessions, syncCamStudyActiveSessionsFromClient };
export type { CamStudySyncSource, VoiceStateSnapshot };
