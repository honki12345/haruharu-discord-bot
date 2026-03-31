import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { testChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { syncSelfServiceOnboardingMessages } from '../../services/selfServiceOnboarding.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [testChannelId],
  data: new SlashCommandBuilder()
    .setName('sync-self-service-ui')
    .setDescription('sync persistent self-service onboarding UI messages')
    .setNameLocalizations({ ko: 'admin-셀프서비스동기화' })
    .setDescriptionLocalizations({
      ko: '관리자가 운영 온보딩 채널의 셀프서비스 버튼 UI를 배포하거나 최신 상태로 갱신합니다',
    })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const results = await syncSelfServiceOnboardingMessages({
        client: interaction.client,
        botUserId: interaction.client.user?.id ?? null,
      });

      await interaction.reply({
        content: [
          '운영 셀프서비스 UI를 동기화했습니다.',
          ...results.map(result => `- ${result.onboardingType}: ${result.action} (${result.channelId})`),
        ].join('\n'),
        ephemeral: true,
      });
    } catch (error) {
      logger.error('sync-self-service-ui failed', { error });
      await interaction.reply({
        content: '운영 셀프서비스 UI 동기화에 실패했습니다.',
        ephemeral: true,
      });
    }
  },
};
