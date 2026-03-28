import { Events, Message } from 'discord.js';
import { createRequire } from 'node:module';
import { classifyAttendanceStatus, getAttendanceStatusEmoji, getAttendanceStatusLabel } from '../attendance.js';
import { logger } from '../logger.js';
import { Users } from '../repository/Users.js';

const jsonRequire = createRequire(import.meta.url);
const { testChannelId } = jsonRequire('../../config.json');

const DEMO_THREAD_SUFFIX = '출석-demo';
const FINAL_ATTENDANCE_EMOJIS = new Set(['✅', '🟡', '❌']);

const hasFinalAttendanceReaction = (message: Message) => {
  return message.reactions.cache.some(reaction => FINAL_ATTENDANCE_EMOJIS.has(reaction.emoji.name ?? ''));
};

const isDuplicateAttendanceMessage = async (message: Message) => {
  const messages = await message.channel.messages.fetch({ limit: 100 });
  return messages.some(candidate => {
    if (candidate.id === message.id) {
      return false;
    }

    return (
      !candidate.author.bot &&
      candidate.author.id === message.author.id &&
      candidate.createdTimestamp <= message.createdTimestamp &&
      hasFinalAttendanceReaction(candidate)
    );
  });
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

    if (await isDuplicateAttendanceMessage(message)) {
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

    const status = classifyAttendanceStatus(user.waketime, new Date(message.createdTimestamp));
    const emoji = getAttendanceStatusEmoji(status);
    await message.react(emoji);

    logger.info('attendance demo recognized', {
      userid: user.userid,
      username: user.username,
      status,
      label: getAttendanceStatusLabel(status),
      threadId: message.channel.id,
      messageId: message.id,
    });
  },
};
