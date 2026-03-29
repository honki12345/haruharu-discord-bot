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
              startHereChannelId: 'start-here-channel',
              opsChannelId: 'ops-channel',
              wakeUpRoleId: 'wake-up-role',
              camStudyRoleId: 'cam-study-role',
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
              startHereChannelId: 'start-here-channel',
              opsChannelId: 'ops-channel',
              wakeUpRoleId: 'wake-up-role',
              camStudyRoleId: 'cam-study-role',
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
              startHereChannelId: 'start-here-channel',
              opsChannelId: 'ops-channel',
              wakeUpRoleId: 'wake-up-role',
              camStudyRoleId: 'cam-study-role',
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

    await expect(import('../deployConfig.js')).resolves.toMatchObject({
      token: 'token',
      clientId: 'client-id',
      guildId: 'guild-id',
    });
  });

  it('startHereChannelId만 있는 최소 runtime 설정은 import 시점에 성공한다', async () => {
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
              startHereChannelId: 'start-here-channel',
              opsChannelId: 'ops-channel',
              wakeUpRoleId: 'wake-up-role',
              camStudyRoleId: 'cam-study-role',
            };
          }

          return original.createRequire(import.meta.url)(path);
        },
      };
    });

    await expect(import('../config.js')).resolves.toMatchObject({
      startHereChannelId: 'start-here-channel',
    });
  });

  it('command deploy 경로는 applyChannelId 없이도 command payload 로딩에 성공한다', async () => {
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
              startHereChannelId: 'start-here-channel',
              opsChannelId: 'ops-channel',
              wakeUpRoleId: 'wake-up-role',
              camStudyRoleId: 'cam-study-role',
            };
          }

          return original.createRequire(import.meta.url)(path);
        },
      };
    });

    vi.doMock('discord.js', async importOriginal => {
      const original = await importOriginal<typeof import('discord.js')>();

      class MockREST {
        setToken() {
          return this;
        }

        async put() {
          return [];
        }
      }

      return {
        ...original,
        REST: MockREST,
        Routes: {
          ...original.Routes,
          applicationGuildCommands: () => 'mock-route',
        },
      };
    });

    await expect(import('../deploy-commands.js')).resolves.toBeDefined();
  });

  it('check-in/check-out 커맨드 모듈은 더 이상 존재하지 않는다', async () => {
    await expect(import('../commands/haruharu/check-in.js')).rejects.toThrow();
    await expect(import('../commands/haruharu/check-out.js')).rejects.toThrow();
  });
});
