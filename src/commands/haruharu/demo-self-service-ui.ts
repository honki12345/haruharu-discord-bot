import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { testChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { buildSelfServiceDemoMessage } from '../../services/selfServiceOnboardingDemo.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [testChannelId],
  data: new SlashCommandBuilder()
    .setName('demo-self-service-ui')
    .setDescription('post a self-service onboarding button demo message in the test channel')
    .setNameLocalizations({ ko: 'admin-demo-셀프서비스ui' })
    .setDescriptionLocalizations({ ko: '관리자가 테스트 채널에 셀프서비스 버튼 UI 데모 메시지를 게시합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),
  async execute(interaction: ChatInputCommandInteraction) {
    const channel = await interaction.client.channels.fetch(testChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.error('demo-self-service-ui invalid test channel', { testChannelId });
      return await interaction.reply({
        content: '테스트 채널을 찾을 수 없습니다',
        ephemeral: true,
      });
    }

    await channel.send(buildSelfServiceDemoMessage());
    await interaction.reply({
      content: '셀프서비스 데모 메시지를 게시했습니다',
      ephemeral: true,
    });
  },
};
