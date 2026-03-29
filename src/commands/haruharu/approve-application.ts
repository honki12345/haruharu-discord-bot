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
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option => option.setName('userid').setDescription('set userid').setRequired(true))
    .addStringOption(option =>
      option
        .setName('program')
        .setDescription('select program')
        .setRequired(true)
        .addChoices({ name: '기상인증', value: 'wake-up' }, { name: '캠스터디', value: 'cam-study' }),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const program = interaction.options.getString('program') as 'wake-up' | 'cam-study';
    await interaction.reply(await approveParticipationApplication(interaction, userid, program));
  },
};
