import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits } from 'discord.js';

const currentFilePath = fileURLToPath(import.meta.url);
const configPath = path.resolve(process.cwd(), 'config.json');

const getRequiredEnv = key => {
  const value = process.env[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const buildIntegrationConfig = ({ token, clientId, guildId, testChannelId, startHereChannelId }) => ({
  token,
  clientId,
  guildId,
  noticeChannelId: testChannelId,
  vacancesRegisterChannelId: testChannelId,
  checkChannelId: testChannelId,
  testChannelId,
  logChannelId: testChannelId,
  resultChannelId: testChannelId,
  voiceChannelId: testChannelId,
  startHereChannelId: startHereChannelId || testChannelId,
  wakeUpRoleId: 'ci-placeholder-wakeup-role',
  camStudyRoleId: 'ci-placeholder-cam-study-role',
});

export const fetchClientId = async token => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(token);

    if (!client.isReady()) {
      await new Promise(resolve => {
        client.once('clientReady', resolve);
      });
    }

    const clientId = client.application?.id ?? (await client.application?.fetch())?.id;

    if (!clientId) {
      throw new Error('Failed to resolve Discord application id from token');
    }

    return clientId;
  } finally {
    await client.destroy();
  }
};

export const writeIntegrationConfig = async () => {
  const token = getRequiredEnv('DISCORD_TOKEN');
  const guildId = getRequiredEnv('TEST_GUILD_ID');
  const testChannelId = getRequiredEnv('TEST_CHANNEL_ID');
  const startHereChannelId = process.env.START_HERE_CHANNEL_ID?.trim() || testChannelId;
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() || (await fetchClientId(token));

  const config = buildIntegrationConfig({
    token,
    clientId,
    guildId,
    testChannelId,
    startHereChannelId,
  });

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
};

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  writeIntegrationConfig()
    .then(writtenPath => {
      console.log(`Wrote integration config to ${writtenPath}`);
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
