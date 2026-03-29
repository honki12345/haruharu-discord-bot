import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('approve-application')
    .setDescription('deprecated: application approval is now automatic')
    .setNameLocalizations({ ko: 'admin-신청승인' })
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
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
      content:
        'deprecated: /approve-application은 더 이상 사용하지 않습니다. `/apply-wakeup`과 `/apply-cam`은 이제 즉시 활성화됩니다.',
      allowedMentions: { parse: [] },
    });
  },
};
