import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { approveParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('approve-application')
    .setDescription('approve a participation application')
    .setNameLocalizations({ ko: 'admin-신청승인' })
    .setDescriptionLocalizations({ ko: '관리자가 참여 신청을 승인합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: '대상 Discord 사용자 ID를 입력합니다' })
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('program')
        .setDescription('select program')
        .setNameLocalizations({ ko: '프로그램' })
        .setDescriptionLocalizations({ ko: '대상 프로그램을 선택합니다' })
        .setRequired(true)
        .addChoices({ name: '캠스터디', value: 'cam-study' }),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const program = interaction.options.getString('program') as 'cam-study';
    await interaction.reply({
      content: await approveParticipationApplication(interaction, userid, program),
      allowedMentions: { parse: [] },
    });
  },
};
