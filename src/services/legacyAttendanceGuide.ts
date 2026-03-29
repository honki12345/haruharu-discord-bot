import { ChatInputCommandInteraction } from 'discord.js';

const buildLegacyAttendanceGuideMessage = (commandName: string, threadMention?: string) => {
  const threadGuide = threadMention
    ? `오늘 출석은 ${threadMention}에서 첫 댓글로 남겨주세요.`
    : '오늘 출석은 오늘의 출석 쓰레드에서 첫 댓글로 남겨주세요.';

  return [
    `/${commandName}은 더 이상 공식 출석 기록 경로가 아닙니다.`,
    '공식 출석은 thread 기반 하루 1회 출석으로만 집계됩니다.',
    threadGuide,
  ].join('\n');
};

const replyWithLegacyAttendanceGuide = async (
  interaction: ChatInputCommandInteraction,
  commandName: 'check-in' | 'check-out',
) => {
  try {
    const [{ checkChannelId }, { ensureTodayAttendanceThread }] = await Promise.all([
      import('../config.js'),
      import('../daily-attendance.js'),
    ]);
    const result = await ensureTodayAttendanceThread(interaction.client, checkChannelId);
    const threadMention = result?.thread?.toString();

    await interaction.reply({
      content: buildLegacyAttendanceGuideMessage(commandName, threadMention),
      ephemeral: true,
    });
  } catch {
    await interaction.reply({
      content: buildLegacyAttendanceGuideMessage(commandName),
      ephemeral: true,
    });
  }
};

export { buildLegacyAttendanceGuideMessage, replyWithLegacyAttendanceGuide };
