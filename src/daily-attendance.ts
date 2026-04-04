import { ChannelType, Client, TextChannel, ThreadAutoArchiveDuration, ThreadChannel } from 'discord.js';
import { pickDailyMessageQuestion } from './daily-message.js';
import { logger } from './logger.js';
import { getYearMonthDate } from './utils.js';

const DAILY_ATTENDANCE_THREAD_SUFFIX = '출석';
const pendingAttendanceThreadCreations = new Map<string, Promise<{ thread: ThreadChannel; created: boolean }>>();

const buildAttendanceThreadName = (year: number, month: string, date: string) => {
  return `${year}-${month}-${date} ${DAILY_ATTENDANCE_THREAD_SUFFIX}`;
};

const buildDailyAttendanceMessageContent = (year: number, month: string, date: string, question: string) => {
  return [
    `[🌅 ${year}-${month}-${date}]`,
    '',
    '오늘의 질문:',
    `"${question}"`,
    '',
    '👇 아래 쓰레드에 오늘 출석과 함께 답변을 남겨주세요',
  ].join('\n');
};

const buildDailyAttendanceThreadGuide = () => {
  return [
    '봇 판정(이모지) 안내',
    '- ⏰ 대기: 출석 가능 시간 전',
    '- ✅ 출석: 등록 시간 ±10분',
    '- 🟡 지각: 등록 시간 +11~30분',
    '- ❌ 결석: 등록 시간 +30분 초과',
    '- 🎁 주말/공휴일 보너스: 출석/지각 성공 댓글에 추가 반응, 13:00에 결석 1회 없으면 지각 1회 차감',
    '- 😌 주말/공휴일 미참여 또는 absent: 무패널티',
    '- ❓ 미등록: 등록되지 않은 사용자',
  ].join('\n');
};

const findExistingAttendanceThread = async (channel: TextChannel, threadName: string) => {
  const activeThreads = await channel.threads.fetchActive();
  const activeThread = activeThreads.threads.find(thread => thread.name === threadName);
  if (activeThread) {
    return activeThread;
  }

  const archivedThreads = await channel.threads.fetchArchived();
  return archivedThreads.threads.find(thread => thread.name === threadName) ?? null;
};

const ensureAttendanceThreadForChannel = async (
  channel: TextChannel,
  threadName: string,
  messageContent: string,
  reason: string,
) => {
  const pendingKey = `${channel.id}:${threadName}`;
  const pendingCreation = pendingAttendanceThreadCreations.get(pendingKey);
  if (pendingCreation) {
    return await pendingCreation;
  }

  const threadCreation = (async () => {
    const existingThread = await findExistingAttendanceThread(channel, threadName);
    if (existingThread) {
      return {
        thread: existingThread as ThreadChannel,
        created: false,
      };
    }

    const dailyMessage = await channel.send(messageContent);
    const thread = await dailyMessage.startThread({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason,
    });
    await thread.send(buildDailyAttendanceThreadGuide());

    return {
      thread,
      created: true,
    };
  })();

  pendingAttendanceThreadCreations.set(pendingKey, threadCreation);

  try {
    return await threadCreation;
  } finally {
    pendingAttendanceThreadCreations.delete(pendingKey);
  }
};

const ensureTodayAttendanceThread = async (client: Client, channelId: string) => {
  const { year, month, date } = getYearMonthDate();
  const threadName = buildAttendanceThreadName(year, month, date);
  const question = pickDailyMessageQuestion();

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.error('daily attendance invalid channel', { channelId, threadName });
      return null;
    }

    const result = await ensureAttendanceThreadForChannel(
      channel as TextChannel,
      threadName,
      buildDailyAttendanceMessageContent(year, month, date, question),
      'daily attendance thread',
    );
    logger.info('daily attendance thread ready', {
      channelId,
      threadId: result.thread.id,
      created: result.created,
      threadName,
    });
    return result;
  } catch (error) {
    logger.error('daily attendance thread creation failed', {
      channelId,
      threadName,
      error,
    });
    throw error;
  }
};

export {
  DAILY_ATTENDANCE_THREAD_SUFFIX,
  buildAttendanceThreadName,
  buildDailyAttendanceMessageContent,
  buildDailyAttendanceThreadGuide,
  findExistingAttendanceThread,
  ensureAttendanceThreadForChannel,
  ensureTodayAttendanceThread,
};
