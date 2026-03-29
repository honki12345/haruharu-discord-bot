import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('register-cam')
    .setDescription('deprecated: grant @cam-study role instead')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option => option.setName('userid').setDescription('set userid').setRequired(true))
    .addStringOption(option => option.setName('username').setDescription('username').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(
      'register-cam is deprecated. Grant the @cam-study role instead to sync CamStudyUsers automatically.',
    );
  },
};
