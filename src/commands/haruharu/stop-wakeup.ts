import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { logger } from '../../logger.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('stop-wakeup')
    .setDescription('stop wake-up program participation')
    .setNameLocalizations({ ko: '기상중단' })
    .setDescriptionLocalizations({ ko: '기상스터디 참여를 중단합니다' }),
  async execute(interaction: ChatInputCommandInteraction) {
    const { executeStopWakeUp } = await import('../../services/challengeSelfService.js');

    try {
      const result = await executeStopWakeUp({
        userId: interaction.user.id,
      });
      await interaction.reply(result.reply);
    } catch (error) {
      logger.error('stop-wakeup 실행 실패', { error });
      await interaction.reply('기상스터디 중단 처리에 실패했습니다');
    }
  },
};
