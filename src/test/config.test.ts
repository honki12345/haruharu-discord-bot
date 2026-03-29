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

  it('sqlite 환경처럼 DB 자격정보가 없어도 import 시점에 실패하지 않는다', async () => {
    vi.doMock('node:module', async importOriginal => {
      const original = await importOriginal<typeof import('node:module')>();
      return {
        ...original,
        createRequire: () => (path: string) => {
          if (path.includes('config.json')) {
            return {
              token: 'token',
              clientId: 'client-id',
              guildId: 'guild-id',
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

    await expect(import('../config.js')).resolves.toMatchObject({
      databaseUser: '',
      password: '',
      token: 'token',
    });
  });

  it('deploy 전용 설정은 런타임 채널 ID 없이 import 시점에 실패하지 않는다', async () => {
    vi.doMock('node:module', async importOriginal => {
      const original = await importOriginal<typeof import('node:module')>();
      return {
        ...original,
        createRequire: () => (path: string) => {
          if (path.includes('config.json')) {
            return {
              token: 'token',
              clientId: 'client-id',
              guildId: 'guild-id',
            };
          }

          return original.createRequire(import.meta.url)(path);
        },
      };
    });

    await expect(import('../deployConfig.js')).resolves.toMatchObject({
      token: 'token',
      clientId: 'client-id',
      guildId: 'guild-id',
    });
  });

  it('check-in/check-out 커맨드 모듈은 더 이상 존재하지 않는다', async () => {
    await expect(import('../commands/haruharu/check-in.js')).rejects.toThrow();
    await expect(import('../commands/haruharu/check-out.js')).rejects.toThrow();
  });
});
