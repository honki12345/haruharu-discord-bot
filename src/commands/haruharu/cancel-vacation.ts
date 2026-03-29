import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('cancel-vacation')
    .setDescription('cancel your vacation for a specific date')
    .addStringOption(option => option.setName('date').setDescription('set date yyyymmdd').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const { executeCancelVacation } = await import('../../services/challengeSelfService.js');
    const result = await executeCancelVacation({
      userId: interaction.user.id,
      yearmonthday: interaction.options.getString('date') ?? '',
    });

    await interaction.reply(result.reply);
  },
};
