import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
  ThreadChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { testChannelId } from '../../config.js';
import { buildDailyAttendanceMessageContent } from '../../daily-attendance.js';
import { pickDailyMessageQuestion } from '../../daily-message.js';
import { logger } from '../../logger.js';
import { getYearMonthDate, PERMISSION_NUM_ADMIN } from '../../utils.js';

const pendingDemoThreadCreations = new Map<string, Promise<{ thread: ThreadChannel; created: boolean }>>();

const findExistingThread = async (channel: TextChannel, threadName: string) => {
  const activeThreads = await channel.threads.fetchActive();
  const activeThread = activeThreads.threads.find(thread => thread.name === threadName);
  if (activeThread) {
    return activeThread;
  }

  const archivedThreads = await channel.threads.fetchArchived();
  return archivedThreads.threads.find(thread => thread.name === threadName) ?? null;
};

export const command = {
  cooldown: 5,
  allowedChannelIds: [testChannelId],
  data: new SlashCommandBuilder()
    .setName('demo-daily-message')
    .setDescription('create a demo daily attendance message in the test channel')
    .setNameLocalizations({ ko: 'admin-demo-출석생성' })
    .setDescriptionLocalizations({ ko: '관리자가 테스트 채널에 데일리 출석 메시지와 데모 쓰레드를 생성합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),
  async execute(interaction: ChatInputCommandInteraction) {
    const { year, month, date } = getYearMonthDate();
    const threadName = `${year}-${month}-${date} 출석-demo`;
    const question = pickDailyMessageQuestion();
    const channel = await interaction.client.channels.fetch(testChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.error('demo-daily-message invalid test channel', { testChannelId });
      return await interaction.reply({
        content: '테스트 채널을 찾을 수 없습니다',
        ephemeral: true,
      });
    }

    const testChannel = channel as TextChannel;
    const pendingThreadCreation = pendingDemoThreadCreations.get(threadName);
    if (pendingThreadCreation) {
      const pendingThread = await pendingThreadCreation;
      return await interaction.reply({
        content: `이미 데모 출석 쓰레드가 있습니다: ${pendingThread.thread.toString()}`,
        ephemeral: true,
      });
    }

    const threadCreation = (async () => {
      const existingThread = await findExistingThread(testChannel, threadName);

      if (existingThread) {
        return {
          thread: existingThread as ThreadChannel,
          created: false,
        };
      }

      const dailyMessage = await testChannel.send(buildDailyAttendanceMessageContent(year, month, date, question));
      const thread = await dailyMessage.startThread({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        reason: 'daily attendance thread demo',
      });

      await thread.send(
        [
          '출석 안내',
          '- ⏰ 대기: 출석 가능 시간 전',
          '- ✅ 출석: 등록 시간 ±10분',
          '- 🟡 지각: 등록 시간 +11~30분',
          '- ❌ 결석: 등록 시간 +30분 초과',
          '- ❓ 미등록: 등록되지 않은 사용자',
        ].join('\n'),
      );

      return {
        thread,
        created: true,
      };
    })();

    pendingDemoThreadCreations.set(threadName, threadCreation);

    let result: { thread: ThreadChannel; created: boolean };
    try {
      result = await threadCreation;
    } finally {
      pendingDemoThreadCreations.delete(threadName);
    }

    await interaction.reply({
      content: `${result.created ? '데모 출석 메시지와 쓰레드를 생성했습니다' : '이미 데모 출석 쓰레드가 있습니다'}: ${result.thread.toString()}`,
      ephemeral: true,
    });
  },
};
