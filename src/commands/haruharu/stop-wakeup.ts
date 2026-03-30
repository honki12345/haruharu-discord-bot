import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../../commandChannelConfig.js';
import { executeStopWakeupSelfService } from '../../services/selfServiceActions.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId, timeStartHereChannelId],
  data: new SlashCommandBuilder()
    .setName('stop-wakeup')
    .setDescription('stop wake-up program participation')
    .setNameLocalizations({ ko: '기상중단' })
    .setDescriptionLocalizations({ ko: '기상스터디 참여를 중단합니다' }),
  async execute(interaction: ChatInputCommandInteraction) {
    await executeStopWakeupSelfService({
      interaction,
      commandName: command.data.name,
    });
  },
};
