import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { getReplyContent, sendSelfServiceAuditLog } from '../../services/selfServiceAudit.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId],
  data: new SlashCommandBuilder()
    .setName('apply-cam')
    .setDescription('apply for cam study program')
    .setNameLocalizations({ ko: '캠스터디신청' })
    .setDescriptionLocalizations({ ko: '캠스터디 참여를 신청합니다' }),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const { submitParticipationApplication } = await import('../../services/participationApplication.js');
      const reply = await submitParticipationApplication(interaction, 'cam-study');
      await interaction.reply(reply);
      await sendSelfServiceAuditLog({
        commandName: command.data.name,
        interaction,
        reply,
      });
    } catch (error) {
      logger.error('apply-cam 실행 실패', { error });
      const reply = {
        content: '캠스터디 참여 처리에 실패했습니다',
        ephemeral: true,
      };
      await interaction.reply(reply);
      await sendSelfServiceAuditLog({
        commandName: command.data.name,
        interaction,
        reply: getReplyContent(reply),
      });
    }
  },
};
