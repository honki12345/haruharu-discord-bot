import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const command = {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('check-out')
    .setDescription('check-out in the world')
    .addAttachmentOption(option =>
      option.setName('image').setDescription('upload the image with timestamp').setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const { executeAttendance } = await import('../../services/attendance.js');
    const result = await executeAttendance({
      action: 'check-out',
      attachment: interaction.options.getAttachment('image'),
      channelId: interaction.channelId,
      globalName: interaction.user.globalName,
      userId: interaction.user.id,
    });

    await interaction.reply(result.reply);
    if (interaction.channel && 'send' in interaction.channel) {
      if (!result.attachmentToForward) {
        return;
      }
      await interaction.channel.send({
        files: [result.attachmentToForward],
      });
    }
  },
};
