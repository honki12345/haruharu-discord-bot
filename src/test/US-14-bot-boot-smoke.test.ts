import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'discord.js';

vi.mock('../repository/Users.js', () => ({
  Users: {
    create: vi.fn(),
    destroy: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../repository/CamStudyUsers.js', () => ({
  CamStudyUsers: {
    create: vi.fn(),
    destroy: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../services/reporting.js', () => ({
  buildCamStudyReports: vi.fn(),
  buildChallengeReport: vi.fn(),
  scheduleDailyReports: vi.fn(),
  syncModels: vi.fn(),
}));

vi.mock('../services/camStudy.js', () => ({
  processCamStudyStateChange: vi.fn(),
}));

vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          token: 'test-token',
          clientId: 'test-client-id',
          guildId: 'test-guild-id',
          databaseUser: 'test-db-user',
          password: 'test-db-password',
          noticeChannelId: 'valid-notice-channel-id',
          vacancesRegisterChannelId: 'valid-vacances-channel-id',
          checkChannelId: 'valid-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
        };
      }

      return original.createRequire(import.meta.url)(path);
    },
  };
});

describe('US-14 bot boot smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Discord 로그인 없이 설정 로딩과 command/event bootstrap이 가능해야 한다', async () => {
    const loginSpy = vi.spyOn(Client.prototype, 'login').mockResolvedValue('unexpected-login');
    const { bootstrapClient } = await import('../runtime.js');

    const client = await bootstrapClient({ login: false });

    expect(loginSpy).not.toHaveBeenCalled();
    expect(client.commands.size).toBeGreaterThan(0);
    expect(client.commands.has('ping')).toBe(true);
    expect(client.eventNames()).toEqual(
      expect.arrayContaining(['clientReady', 'interactionCreate', 'messageCreate', 'voiceStateUpdate']),
    );

    client.destroy();
  });
});
