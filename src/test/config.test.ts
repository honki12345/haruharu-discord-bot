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

  it('check-in/check-out 커맨드 모듈은 런타임 채널 ID 없이도 import 된다', async () => {
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

    const checkInModule = await import('../commands/haruharu/check-in.js');
    const checkOutModule = await import('../commands/haruharu/check-out.js');

    expect(checkInModule).toHaveProperty('command');
    expect(checkOutModule).toHaveProperty('command');
    expect(checkInModule.command.data.toJSON()).toMatchObject({
      name: 'check-in',
      description: 'deprecated: use today attendance thread',
    });
    expect(checkOutModule.command.data.toJSON()).toMatchObject({
      name: 'check-out',
      description: 'deprecated: use today attendance thread',
    });
    expect(checkInModule.command.data.toJSON().options).toEqual([]);
    expect(checkOutModule.command.data.toJSON().options).toEqual([]);
  });
});
