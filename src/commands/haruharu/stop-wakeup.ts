import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { replyWithEphemeralAudit } from '../../services/selfServiceAudit.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId, timeStartHereChannelId],
  data: new SlashCommandBuilder()
    .setName('stop-wakeup')
    .setDescription('stop wake-up program participation')
    .setNameLocalizations({ ko: '기상중단' })
    .setDescriptionLocalizations({ ko: '기상스터디 참여를 중단합니다' }),
  async execute(interaction: ChatInputCommandInteraction) {
    const { executeStopWakeUpWithRoleSync } = await import('../../services/challengeSelfService.js');

    try {
      const result = await executeStopWakeUpWithRoleSync({
        userId: interaction.user.id,
        guild: interaction.guild,
      });
      await replyWithEphemeralAudit({
        commandName: command.data.name,
        interaction,
        content: result.reply,
      });
    } catch (error) {
      logger.error('stop-wakeup 실행 실패', { error });
      await replyWithEphemeralAudit({
        commandName: command.data.name,
        interaction,
        content: '기상스터디 중단 처리에 실패했습니다',
      });
    }
  },
};
