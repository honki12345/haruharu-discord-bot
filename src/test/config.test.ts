import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalAppEnv = process.env.APP_ENV;
const originalNodeEnv = process.env.NODE_ENV;
const originalConfigPath = process.env.HARUHARU_CONFIG_PATH;

const cleanupPaths = new Set<string>();

function writeConfig(databasePath: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haruharu-config-loader-'));
  const configPath = path.join(dir, 'dev.test.json');

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      environment: 'dev',
      token: 'test-token',
      clientId: 'test-client-id',
      guildId: 'test-guild-id',
      checkChannelId: 'check-channel-id',
      logChannelId: 'log-channel-id',
      resultChannelId: 'result-channel-id',
      voiceChannelId: 'voice-channel-id',
      noticeChannelId: 'notice-channel-id',
      vacancesRegisterChannelId: 'vacances-register-channel-id',
      testChannelId: 'test-channel-id',
      databasePath,
      pm2AppName: 'haruharu-bot-test',
    }),
  );

  cleanupPaths.add(dir);
  process.env.APP_ENV = 'dev';
  process.env.NODE_ENV = 'test';
  process.env.HARUHARU_CONFIG_PATH = configPath;
}

async function loadFreshConfigModule() {
  vi.resetModules();
  return await import('../config.js');
}

afterEach(() => {
  process.env.APP_ENV = originalAppEnv;
  process.env.NODE_ENV = originalNodeEnv;
  process.env.HARUHARU_CONFIG_PATH = originalConfigPath;

  for (const cleanupPath of cleanupPaths) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
  }
  cleanupPaths.clear();
});

describe('config loader', () => {
  it('preserves sqlite :memory: paths', async () => {
    writeConfig(':memory:');

    const { appConfig } = await loadFreshConfigModule();

    expect(appConfig.databasePath).toBe(':memory:');
  });

  it('preserves sqlite file URI paths', async () => {
    writeConfig('file::memory:?cache=shared');

    const { appConfig } = await loadFreshConfigModule();

    expect(appConfig.databasePath).toBe('file::memory:?cache=shared');
  });
});
