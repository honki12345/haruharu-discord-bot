import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('reject-application')
    .setDescription('deprecated: application rejection is no longer used')
    .setNameLocalizations({ ko: 'admin-신청거절' })
    .setDescriptionLocalizations({ ko: '자동 승인 전환으로 더 이상 사용하지 않는 레거시 명령입니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: '대상 Discord 사용자 ID를 입력합니다' })
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('program')
        .setDescription('select program')
        .setNameLocalizations({ ko: '프로그램' })
        .setDescriptionLocalizations({ ko: '대상 프로그램을 선택합니다' })
        .setRequired(false)
        .addChoices({ name: '기상인증', value: 'wake-up' }, { name: '캠스터디', value: 'cam-study' }),
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('set rejection reason')
        .setNameLocalizations({ ko: '사유' })
        .setDescriptionLocalizations({ ko: '거절 사유를 입력합니다' })
        .setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
      content: 'deprecated: /reject-application은 더 이상 사용하지 않습니다. self-service 신청은 이제 자동 승인됩니다.',
      allowedMentions: { parse: [] },
    });
  },
};
