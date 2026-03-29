import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { applyChannelId } from '../../config.js';
import { submitParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [applyChannelId],
  data: new SlashCommandBuilder().setName('apply-wakeup').setDescription('apply for wake-up program'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(await submitParticipationApplication(interaction, 'wake-up'));
  },
};
