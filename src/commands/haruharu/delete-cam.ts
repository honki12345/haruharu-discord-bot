import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('delete-cam')
    .setDescription('deprecated: remove the cam-study role instead')
    .setNameLocalizations({ ko: 'admin-캠스터디삭제' })
    .setDescriptionLocalizations({ ko: '자동 역할 연동으로 더 이상 사용하지 않는 레거시 명령입니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: '대상 Discord 사용자 ID를 입력합니다' })
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(
      'deprecated: /delete-cam은 더 이상 사용하지 않습니다. `@cam-study` 역할을 제거하면 자동으로 해제됩니다.',
    );
  },
};
