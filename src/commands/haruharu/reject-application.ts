import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { opsChannelId } from '../../config.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { rejectParticipationApplication } from '../../services/participationApplication.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [opsChannelId],
  data: new SlashCommandBuilder()
    .setName('reject-application')
    .setDescription('reject a participation application')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option => option.setName('userid').setDescription('set userid').setRequired(true))
    .addStringOption(option =>
      option
        .setName('program')
        .setDescription('select program')
        .setRequired(true)
        .addChoices({ name: '기상인증', value: 'wake-up' }, { name: '캠스터디', value: 'cam-study' }),
    )
    .addStringOption(option => option.setName('reason').setDescription('set rejection reason').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const program = interaction.options.getString('program') as 'wake-up' | 'cam-study';
    const reason = interaction.options.getString('reason')!;
    await interaction.reply(await rejectParticipationApplication(interaction, userid, program, reason));
  },
};
