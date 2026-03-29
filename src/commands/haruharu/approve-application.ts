import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { approveParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('approve-application')
    .setDescription('deprecated: participation is activated automatically')
    .setNameLocalizations({ ko: 'admin-신청승인' })
    .setDescriptionLocalizations({ ko: 'deprecated: 참여는 자동으로 활성화됩니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('deprecated legacy userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: 'deprecated 레거시 사용자 ID' })
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('program')
        .setDescription('deprecated legacy program')
        .setRequired(false)
        .setNameLocalizations({ ko: '프로그램' })
        .setDescriptionLocalizations({ ko: 'deprecated 레거시 프로그램' })
        .addChoices({ name: '기상인증', value: 'wake-up' }, { name: '캠스터디', value: 'cam-study' }),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid') ?? interaction.user.id;
    const program = (interaction.options.getString('program') as 'wake-up' | 'cam-study' | null) ?? 'wake-up';
    await interaction.reply({
      content: await approveParticipationApplication(interaction, userid, program),
      allowedMentions: { parse: [] },
    });
  },
};
