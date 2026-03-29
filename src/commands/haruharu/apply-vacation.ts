import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('apply-vacation')
    .setDescription('apply your vacation for a specific date')
    .addStringOption(option => option.setName('date').setDescription('set date yyyymmdd').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const { executeApplyVacation } = await import('../../services/challengeSelfService.js');
    const result = await executeApplyVacation({
      userId: interaction.user.id,
      yearmonthday: interaction.options.getString('date') ?? '',
    });

    await interaction.reply(result.reply);
  },
};
