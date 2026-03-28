import { afterEach, describe, expect, it, vi } from 'vitest';

describe('config.ts', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('node:module');
  });

  it('필수 설정값이 비어 있으면 import 시점에 실패한다', async () => {
    vi.doMock('node:module', async importOriginal => {
      const original = await importOriginal<typeof import('node:module')>();
      return {
        ...original,
        createRequire: () => (path: string) => {
          if (path.includes('config.json')) {
            return {
              token: '',
              clientId: 'client-id',
              guildId: 'guild-id',
              databaseUser: 'db-user',
              password: 'db-password',
              noticeChannelId: 'notice-channel',
              vacancesRegisterChannelId: 'vacances-channel',
              checkChannelId: 'check-channel',
              testChannelId: 'test-channel',
              logChannelId: 'log-channel',
              resultChannelId: 'result-channel',
              voiceChannelId: 'voice-channel',
            };
          }

          return original.createRequire(import.meta.url)(path);
        },
      };
    });

    await expect(import('../config.js')).rejects.toThrow('Missing required configuration value for "token"');
  });
});
