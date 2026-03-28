import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { executeAttendance } from '../../services/attendance.js';

export const command = {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('check-in')
    .setDescription('check-in in the world')
    .addAttachmentOption(option =>
      option.setName('image').setDescription('upload the image with timestamp').setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const result = await executeAttendance({
      action: 'check-in',
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
