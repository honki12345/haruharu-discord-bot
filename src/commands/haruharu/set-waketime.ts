import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('set-waketime')
    .setDescription('change your waketime for current challenge month')
    .addStringOption(option => option.setName('waketime').setDescription('set waketime HHmm').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const { executeSetWaketime } = await import('../../services/challengeSelfService.js');
    const result = await executeSetWaketime({
      userId: interaction.user.id,
      waketime: interaction.options.getString('waketime') ?? '',
    });

    await interaction.reply(result.reply);
  },
};
