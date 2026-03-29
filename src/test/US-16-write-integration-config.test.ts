import { describe, expect, it } from 'vitest';
import { buildIntegrationConfig } from '../../scripts/write-integration-config.mjs';

describe('US-16 integration command sync config', () => {
  it('integration command sync용 config는 slash command 로딩에 필요한 필수 키를 채워야 한다', () => {
    const config = buildIntegrationConfig({
      token: 'discord-token',
      clientId: 'discord-client-id',
      guildId: 'discord-guild-id',
      testChannelId: 'discord-test-channel-id',
      startHereChannelId: 'discord-start-here-channel-id',
    });

    expect(config).toMatchObject({
      token: 'discord-token',
      clientId: 'discord-client-id',
      guildId: 'discord-guild-id',
      noticeChannelId: 'discord-test-channel-id',
      vacancesRegisterChannelId: 'discord-test-channel-id',
      checkChannelId: 'discord-test-channel-id',
      testChannelId: 'discord-test-channel-id',
      logChannelId: 'discord-test-channel-id',
      resultChannelId: 'discord-test-channel-id',
      voiceChannelId: 'discord-test-channel-id',
      startHereChannelId: 'discord-start-here-channel-id',
      wakeUpRoleId: 'ci-placeholder-wakeup-role',
      camStudyRoleId: 'ci-placeholder-cam-study-role',
    });
  });

  it('startHereChannelId가 비어 있으면 testChannelId를 fallback으로 사용해야 한다', () => {
    const config = buildIntegrationConfig({
      token: 'discord-token',
      clientId: 'discord-client-id',
      guildId: 'discord-guild-id',
      testChannelId: 'discord-test-channel-id',
      startHereChannelId: '',
    });

    expect(config.startHereChannelId).toBe('discord-test-channel-id');
  });
});
