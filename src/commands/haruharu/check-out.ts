import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { replyWithLegacyAttendanceGuide } from '../../services/legacyAttendanceGuide.js';

export const command = {
  cooldown: 30,

  data: new SlashCommandBuilder().setName('check-out').setDescription('deprecated: use today attendance thread'),

  async execute(interaction: ChatInputCommandInteraction) {
    await replyWithLegacyAttendanceGuide(interaction, 'check-out');
  },
};
