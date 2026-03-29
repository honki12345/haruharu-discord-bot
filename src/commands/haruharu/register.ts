import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../../config.js';
import { logger } from '../../logger.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId, timeStartHereChannelId],
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('register or update your challenge waketime')
    .setNameLocalizations({ ko: '기상등록' })
    .setDescriptionLocalizations({ ko: '자신의 기상시간을 등록하거나 수정합니다' })
    .addStringOption(option =>
      option
        .setName('waketime')
        .setDescription('set waketime HHmm')
        .setNameLocalizations({ ko: '기상시간' })
        .setDescriptionLocalizations({ ko: '기상시간을 입력합니다 (HHmm)' })
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const waketime = interaction.options.getString('waketime')!;
    const userId = interaction.user.id;
    const username = interaction.user.globalName ?? 'unknown';
    logger.info(`register 명령행에 입력한 값: userid: ${userId}, waketime: ${waketime}`);

    const { executeRegister } = await import('../../services/challengeSelfService.js');

    try {
      const result = await executeRegister({
        userId,
        username,
        waketime,
      });
      await interaction.reply(result.reply);
    } catch (e) {
      logger.error(`register 등록 실패`, { e });
      await interaction.reply(`register 등록 실패`);
    }
  },
};
