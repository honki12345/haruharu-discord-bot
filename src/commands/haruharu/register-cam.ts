import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('register-cam')
    .setDescription('deprecated: grant @cam-study role instead')
    .setNameLocalizations({ ko: 'admin-캠스터디등록' })
    .setDescriptionLocalizations({ ko: 'deprecated: @cam-study 역할 부여로 등록합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: 'deprecated 레거시 사용자 ID' })
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('username')
        .setNameLocalizations({ ko: '이름' })
        .setDescriptionLocalizations({ ko: 'deprecated 레거시 표시 이름' })
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(
      'register-cam is deprecated. Grant the @cam-study role instead to sync CamStudyUsers automatically.',
    );
  },
};
