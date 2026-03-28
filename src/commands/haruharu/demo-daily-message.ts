import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { createRequire } from 'node:module';
import { pickDailyMessageQuestion } from '../../daily-message.js';
import { logger } from '../../logger.js';
import { getYearMonthDate, PERMISSION_NUM_ADMIN } from '../../utils.js';

const jsonRequire = createRequire(import.meta.url);
const { testChannelId } = jsonRequire('../../../config.json');

const findExistingThread = async (channel: TextChannel, threadName: string) => {
  const activeThreads = await channel.threads.fetchActive();
  const activeThread = activeThreads.threads.find(thread => thread.name === threadName);
  if (activeThread) {
    return activeThread;
  }

  const archivedThreads = await channel.threads.fetchArchived();
  return archivedThreads.threads.find(thread => thread.name === threadName) ?? null;
};

const buildDailyMessageContent = (year: number, month: string, date: string, question: string) => {
  return [
    `[🌅 ${year}-${month}-${date}]`,
    '',
    '오늘의 한마디:',
    '"완벽하려고 하지 말고, 시작하자."',
    '',
    '👉 오늘 목표 하나만 적고 시작해보세요',
    `📝 오늘의 질문: ${question}`,
    '👇 반드시 아래 쓰레드에서 오늘 출석을 남겨주세요',
  ].join('\n');
};

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('demo-daily-message')
    .setDescription('create a demo daily attendance message in the test channel')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),
  async execute(interaction: ChatInputCommandInteraction) {
    const { year, month, date } = getYearMonthDate();
    const threadName = `${year}-${month}-${date} 출석-demo`;
    const question = pickDailyMessageQuestion();
    const channel = await interaction.client.channels.fetch(testChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.error('demo-daily-message invalid test channel', { testChannelId });
      return await interaction.reply({
        content: 'test channel is not available',
        ephemeral: true,
      });
    }

    const testChannel = channel as TextChannel;
    const existingThread = await findExistingThread(testChannel, threadName);

    if (existingThread) {
      return await interaction.reply({
        content: `이미 데모 출석 쓰레드가 있습니다: ${existingThread.toString()}`,
        ephemeral: true,
      });
    }

    const dailyMessage = await testChannel.send(buildDailyMessageContent(year, month, date, question));
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

    await interaction.reply({
      content: `데모 daily message와 쓰레드를 생성했습니다: ${thread.toString()}`,
      ephemeral: true,
    });
  },
};
