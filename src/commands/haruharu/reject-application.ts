import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { rejectParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('reject-application')
    .setDescription('deprecated: participation is activated automatically')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option => option.setName('userid').setDescription('deprecated legacy userid').setRequired(false))
    .addStringOption(option =>
      option
        .setName('program')
        .setDescription('deprecated legacy program')
        .setRequired(false)
        .addChoices({ name: '기상인증', value: 'wake-up' }, { name: '캠스터디', value: 'cam-study' }),
    )
    .addStringOption(option => option.setName('reason').setDescription('deprecated legacy reason').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid') ?? interaction.user.id;
    const program = (interaction.options.getString('program') as 'wake-up' | 'cam-study' | null) ?? 'wake-up';
    const reason = interaction.options.getString('reason') ?? 'deprecated';
    await interaction.reply({
      content: await rejectParticipationApplication(interaction, userid, program, reason),
      allowedMentions: { parse: [] },
    });
  },
};
