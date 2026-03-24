import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { createRequire } from 'node:module';
import { logger } from '../../logger.js';
import { getYearMonthDate, PERMISSION_NUM_ADMIN } from '../../utils.js';

const jsonRequire = createRequire(import.meta.url);
const { testChannelId } = jsonRequire('../../../config.json');

const buildDailyMessageContent = (year: number, month: string, date: string) => {
  return [
    `[🌅 ${year}-${month}-${date}]`,
    '',
    '오늘의 한마디:',
    '"완벽하려고 하지 말고, 시작하자."',
    '',
    '👉 오늘 목표 하나만 적고 시작해보세요',
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
    const channel = await interaction.client.channels.fetch(testChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.error('demo-daily-message invalid test channel', { testChannelId });
      return await interaction.reply({
        content: 'test channel is not available',
        ephemeral: true,
      });
    }

    const testChannel = channel as TextChannel;
    const activeThreads = await testChannel.threads.fetchActive();
    const existingThread = activeThreads.threads.find(thread => thread.name === threadName);

    if (existingThread) {
      return await interaction.reply({
        content: `이미 데모 출석 쓰레드가 있습니다: ${existingThread.toString()}`,
        ephemeral: true,
      });
    }

    const dailyMessage = await testChannel.send(buildDailyMessageContent(year, month, date));
    const thread = await dailyMessage.startThread({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: 'daily attendance thread demo',
    });

    await thread.send([
      '데모 안내',
      '- 등록 시간 10분 전부터 출석 가능',
      '- 등록 시간 10분 후까지는 정상 출석',
      '- 등록 시간 30분 후까지는 지각',
      '- 그 이후 메시지는 결석으로 판정',
      '- 첫 댓글 시간만 판정에 사용',
    ].join('\n'));

    await interaction.reply({
      content: `데모 daily message와 쓰레드를 생성했습니다: ${thread.toString()}`,
      ephemeral: true,
    });
  },
};
