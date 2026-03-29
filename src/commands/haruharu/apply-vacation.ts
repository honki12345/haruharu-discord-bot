import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { replyWithEphemeralAudit } from '../../services/selfServiceAudit.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId, timeStartHereChannelId],
  data: new SlashCommandBuilder()
    .setName('apply-vacation')
    .setDescription('apply your vacation for a specific date')
    .setNameLocalizations({ ko: '휴가신청' })
    .setDescriptionLocalizations({ ko: '특정 날짜에 사용할 휴가를 신청합니다' })
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('set date yyyymmdd')
        .setNameLocalizations({ ko: '날짜' })
        .setDescriptionLocalizations({ ko: '휴가 날짜를 입력합니다 (yyyymmdd)' })
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const { executeApplyVacation } = await import('../../services/challengeSelfService.js');
      const result = await executeApplyVacation({
        userId: interaction.user.id,
        yearmonthday: interaction.options.getString('date') ?? '',
      });

      await replyWithEphemeralAudit({
        commandName: command.data.name,
        interaction,
        content: result.reply,
      });
    } catch (error) {
      logger.error('apply-vacation 실행 실패', { error });
      await replyWithEphemeralAudit({
        commandName: command.data.name,
        interaction,
        content: '휴가 신청 처리에 실패했습니다',
      });
    }
  },
};
