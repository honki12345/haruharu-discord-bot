import { ChannelType, Client, TextChannel, ThreadAutoArchiveDuration, ThreadChannel } from 'discord.js';
import { pickDailyMessageQuestion } from './daily-message.js';
import { logger } from './logger.js';

const DAILY_ATTENDANCE_THREAD_SUFFIX = '출석';
const KOREA_TIME_ZONE = 'Asia/Seoul';
const pendingAttendanceThreadCreations = new Map<string, Promise<{ thread: ThreadChannel; created: boolean }>>();

const getKoreaDateParts = (at: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(at);
  const readPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find(part => part.type === type)?.value;
    if (!value) {
      throw new Error(`Missing ${type} while formatting Korea date parts`);
    }

    return value;
  };

  return {
    year: Number(readPart('year')),
    month: readPart('month'),
    date: readPart('day'),
  };
};

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
    '- 🌅 얼리 출석: 등록 시간 -11분 이전 댓글도 출석으로 인정, ✅와 함께 추가 반응',
    '- ✅ 출석: 등록 시간 -10분~+10분',
    '- 🟡 +11분~12:59 지각: 등록 시간 이후에도 당일 12:59까지는 지각',
    '- ❌ 결석: 13:00 집계 무댓글 결석',
    '- 🎁 주말/공휴일 보너스: 출석/지각 성공 댓글에 추가 반응, 13:00에 결석 1회 없으면 지각 1회 차감',
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
  const { year, month, date } = getKoreaDateParts();
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
  getKoreaDateParts,
  ensureAttendanceThreadForChannel,
  ensureTodayAttendanceThread,
};
