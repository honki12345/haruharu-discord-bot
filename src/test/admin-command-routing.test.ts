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
          noticeChannelId: 'valid-notice-channel-id',
          vacancesRegisterChannelId: 'valid-vacances-channel-id',
          checkChannelId: 'valid-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
          startHereChannelId: 'valid-start-here-channel-id',
          wakeUpRoleId: 'valid-wake-up-role-id',
          camStudyRoleId: 'valid-cam-study-role-id',
        };
      }

      return original.createRequire(import.meta.url)(path);
    },
  };
});

const adminCommandSpecs = [
  '../commands/haruharu/add-vacances.js',
  '../commands/haruharu/delete.js',
  '../commands/haruharu/demo-daily-message.js',
  '../commands/haruharu/ping.js',
] as const;

const removedLegacyAdminCommands = [
  '../commands/haruharu/approve-application.js',
  '../commands/haruharu/reject-application.js',
  '../commands/haruharu/register-cam.js',
  '../commands/haruharu/delete-cam.js',
] as const;

describe('관리자 명령 채널 라우팅', () => {
  it('남은 관리자 명령은 testChannelId에서만 실행되도록 고정된다', async () => {
    for (const modulePath of adminCommandSpecs) {
      const { command } = await import(modulePath);
      expect(command.allowedChannelIds).toEqual(['valid-test-channel-id']);
    }
  });

  it('레거시 관리자 명령 모듈은 더 이상 존재하지 않는다', async () => {
    for (const modulePath of removedLegacyAdminCommands) {
      await expect(import(modulePath)).rejects.toThrow();
    }
  });

  it('슬래시 커맨드 payload에는 제거된 레거시 관리자 명령이 포함되지 않는다', async () => {
    const { getSlashCommandPayloads } = await import('../runtime.js');
    const payloads = await getSlashCommandPayloads();
    const commandNames = payloads.map(payload => payload.name);

    expect(commandNames).toContain('ping');
    expect(commandNames).toContain('delete');
    expect(commandNames).toContain('add-vacances');
    expect(commandNames).toContain('demo-daily-message');
    expect(commandNames).not.toContain('approve-application');
    expect(commandNames).not.toContain('reject-application');
    expect(commandNames).not.toContain('register-cam');
    expect(commandNames).not.toContain('delete-cam');
  });
});
