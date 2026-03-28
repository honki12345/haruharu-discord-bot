import { Events, Message } from 'discord.js';
import { createRequire } from 'node:module';
import { classifyAttendanceStatus, getAttendanceStatusEmoji, getAttendanceStatusLabel } from '../attendance.js';
import { logger } from '../logger.js';
import { Users } from '../repository/Users.js';

const jsonRequire = createRequire(import.meta.url);
const { testChannelId } = jsonRequire('../../config.json');

const DEMO_THREAD_SUFFIX = '출석-demo';
const FINAL_ATTENDANCE_EMOJIS = new Set(['✅', '🟡', '❌']);
const finalizedAttendanceCache = new Map<string, Set<string>>();
const inFlightAttendanceKeys = new Set<string>();
const pendingAttendanceMessages = new Map<string, Message>();

const getAttendanceCacheKey = (threadId: string, userId: string) => `${threadId}:${userId}`;

const hasBotFinalAttendanceReaction = async (message: Message, botUserId?: string) => {
  if (!botUserId) {
    return false;
  }

  for (const reaction of message.reactions.cache.values()) {
    if (!FINAL_ATTENDANCE_EMOJIS.has(reaction.emoji.name ?? '')) {
      continue;
    }

    if (reaction.users.cache.has(botUserId)) {
      return true;
    }

    if (typeof reaction.users.fetch === 'function') {
      const users = await reaction.users.fetch();
      if (users.has(botUserId)) {
        return true;
      }
    }
  }

  return false;
};

const rememberFinalAttendance = (threadId: string, userId: string) => {
  const users = finalizedAttendanceCache.get(threadId) ?? new Set<string>();
  users.add(userId);
  finalizedAttendanceCache.set(threadId, users);
};

const hasRememberedFinalAttendance = (threadId: string, userId: string) => {
  return finalizedAttendanceCache.get(threadId)?.has(userId) ?? false;
};

const findPriorFinalAttendance = async (message: Message) => {
  const botUserId = message.client?.user?.id;
  let before: string | undefined;
  let hasMoreMessages = true;

  while (hasMoreMessages) {
    const messages = await message.channel.messages.fetch(before ? { before, limit: 100 } : { limit: 100 });
    if (messages.size === 0) {
      return false;
    }

    for (const candidate of messages.values()) {
      if (candidate.id === message.id) {
        continue;
      }

      if (
        !candidate.author.bot &&
        candidate.author.id === message.author.id &&
        candidate.createdTimestamp <= message.createdTimestamp &&
        (await hasBotFinalAttendanceReaction(candidate, botUserId))
      ) {
        rememberFinalAttendance(message.channel.id, message.author.id);
        return true;
      }
    }

    if (messages.size < 100) {
      return false;
    }

    before = messages.lastKey();
    if (!before) {
      hasMoreMessages = false;
    }
  }

  return false;
};

const processAttendanceMessage = async (message: Message, attendanceKey: string) => {
  inFlightAttendanceKeys.add(attendanceKey);

  try {
    if (await findPriorFinalAttendance(message)) {
      return;
    }

    const createdAt = new Date(message.createdTimestamp);
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const user = await Users.findOne({
      where: {
        userid: message.author.id,
        yearmonth: `${year}${month}`,
      },
    });

    if (!user) {
      logger.info('attendance demo ignored for unregistered user', {
        userid: message.author.id,
        threadId: message.channel.id,
      });
      await message.react('❓');
      return;
    }

    let status;
    try {
      status = classifyAttendanceStatus(user.waketime, createdAt);
    } catch (error) {
      logger.warn('attendance demo ignored for invalid waketime', {
        userid: user.userid,
        username: user.username,
        waketime: user.waketime,
        threadId: message.channel.id,
        messageId: message.id,
        error,
      });
      await message.react('❓');
      return;
    }

    const emoji = getAttendanceStatusEmoji(status);
    await message.react(emoji);

    if (FINAL_ATTENDANCE_EMOJIS.has(emoji)) {
      rememberFinalAttendance(message.channel.id, message.author.id);
    }

    logger.info('attendance demo recognized', {
      userid: user.userid,
      username: user.username,
      status,
      label: getAttendanceStatusLabel(status),
      threadId: message.channel.id,
      messageId: message.id,
    });
  } finally {
    inFlightAttendanceKeys.delete(attendanceKey);

    const pendingMessage = pendingAttendanceMessages.get(attendanceKey);
    const shouldProcessPending =
      pendingMessage &&
      pendingMessage.id !== message.id &&
      !hasRememberedFinalAttendance(message.channel.id, message.author.id);

    if (shouldProcessPending || pendingMessage?.id === message.id) {
      pendingAttendanceMessages.delete(attendanceKey);
    }

    if (shouldProcessPending && pendingMessage) {
      await processAttendanceMessage(pendingMessage, attendanceKey);
    }
  }
};

export const event = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot || !message.inGuild() || !message.channel.isThread()) {
      return;
    }

    if (message.channel.parentId !== testChannelId || !message.channel.name.endsWith(DEMO_THREAD_SUFFIX)) {
      return;
    }

    const attendanceKey = getAttendanceCacheKey(message.channel.id, message.author.id);
    if (hasRememberedFinalAttendance(message.channel.id, message.author.id)) {
      return;
    }

    if (inFlightAttendanceKeys.has(attendanceKey)) {
      pendingAttendanceMessages.set(attendanceKey, message);
      return;
    }

    await processAttendanceMessage(message, attendanceKey);
  },
};
