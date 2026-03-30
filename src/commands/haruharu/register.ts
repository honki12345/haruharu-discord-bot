import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../../commandChannelConfig.js';
import { executeRegisterSelfService } from '../../services/selfServiceActions.js';

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
        .setDescription('set waketime HHmm or HH:mm')
        .setNameLocalizations({ ko: '기상시간' })
        .setDescriptionLocalizations({ ko: '기상시간을 입력합니다 (HHmm 또는 HH:mm)' })
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await executeRegisterSelfService({
      interaction,
      waketime: interaction.options.getString('waketime') ?? '',
      commandName: command.data.name,
    });
  },
};
