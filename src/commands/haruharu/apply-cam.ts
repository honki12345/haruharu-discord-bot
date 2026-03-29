import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { applyChannelId } from '../../config.js';
import { submitParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [applyChannelId],
  data: new SlashCommandBuilder().setName('apply-cam').setDescription('apply for cam study program'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(await submitParticipationApplication(interaction, 'cam-study'));
  },
};
