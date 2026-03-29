import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { applyChannelId } from '../../config.js';
import { submitParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [applyChannelId],
  data: new SlashCommandBuilder()
    .setName('apply-wakeup')
    .setDescription('apply for wake-up program')
    .setNameLocalizations({ ko: '기상인증신청' })
    .setDescriptionLocalizations({ ko: '기상인증 참여를 신청합니다' }),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(await submitParticipationApplication(interaction, 'wake-up'));
  },
};
