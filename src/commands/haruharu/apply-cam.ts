import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId } from '../../commandChannelConfig.js';
import { executeApplyCamSelfService } from '../../services/selfServiceActions.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId],
  data: new SlashCommandBuilder()
    .setName('apply-cam')
    .setDescription('apply for cam study program')
    .setNameLocalizations({ ko: '캠스터디신청' })
    .setDescriptionLocalizations({ ko: '캠스터디 참여를 신청합니다' }),
  async execute(interaction: ChatInputCommandInteraction) {
    await executeApplyCamSelfService({
      interaction,
      commandName: command.data.name,
    });
  },
};
