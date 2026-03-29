import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('delete-cam')
    .setDescription('deprecated: remove @cam-study role instead')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option => option.setName('userid').setDescription('set userid').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(
      'delete-cam is deprecated. Remove the @cam-study role instead to unsync CamStudyUsers automatically.',
    );
  },
};
