import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { testChannelId } from '../../commandChannelConfig.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [testChannelId],
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .setNameLocalizations({ ko: 'admin-상태확인' })
    .setDescriptionLocalizations({ ko: '관리자가 봇 응답 상태를 확인합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),

  async execute(interaction: ChatInputCommandInteraction) {
    // await interaction.reply('Pang');
    await interaction.reply({ content: '상태 확인이 완료되었습니다', ephemeral: true });
  },
};
