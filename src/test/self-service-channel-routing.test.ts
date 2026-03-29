import { describe, expect, it, vi } from 'vitest';

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
          checkChannelId: 'valid-check-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
          startHereChannelId: 'valid-start-here-channel-id',
          timeStartHereChannelId: 'valid-time-start-here-channel-id',
          wakeUpRoleId: 'valid-wake-up-role-id',
          camStudyRoleId: 'valid-cam-study-role-id',
        };
      }

      return original.createRequire(import.meta.url)(path);
    },
  };
});

const selfServiceCommandSpecs = [
  '../commands/haruharu/register.js',
  '../commands/haruharu/stop-wakeup.js',
  '../commands/haruharu/apply-vacation.js',
] as const;

describe('기상 self-service 명령 채널 라우팅', () => {
  it('기상 self-service 명령은 start-here 계열 2개 채널에서만 실행되도록 고정된다', async () => {
    for (const modulePath of selfServiceCommandSpecs) {
      const { command } = await import(modulePath);
      expect(command.allowedChannelIds).toEqual(['valid-start-here-channel-id', 'valid-time-start-here-channel-id']);
    }
  });
});
