import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),

  async execute(interaction: ChatInputCommandInteraction) {
    // await interaction.reply('Pang');
    await interaction.reply({ content: 'ping success', ephemeral: true });
  },
};
