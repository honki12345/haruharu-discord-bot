import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('delete-cam')
    .setDescription('deprecated: remove @cam-study role instead')
    .setNameLocalizations({ ko: 'admin-캠스터디삭제' })
    .setDescriptionLocalizations({ ko: 'deprecated: @cam-study 역할 회수로 해제합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: 'deprecated 레거시 사용자 ID' })
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(
      'delete-cam is deprecated. Remove the @cam-study role instead to unsync CamStudyUsers automatically.',
    );
  },
};
