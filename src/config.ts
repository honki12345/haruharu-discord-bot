import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type AppEnvironment = 'dev' | 'prod';

interface RawAppConfig {
  environment?: AppEnvironment;
  token?: string;
  clientId?: string;
  guildId?: string;
  checkChannelId?: string;
  logChannelId?: string;
  resultChannelId?: string;
  voiceChannelId?: string;
  noticeChannelId?: string;
  vacancesRegisterChannelId?: string;
  testChannelId?: string;
  databasePath?: string;
  pm2AppName?: string;
}

export interface AppConfig {
  environment: AppEnvironment;
  token: string;
  clientId: string;
  guildId: string;
  checkChannelId: string;
  logChannelId: string;
  resultChannelId: string;
  voiceChannelId: string;
  noticeChannelId: string;
  vacancesRegisterChannelId: string;
  testChannelId: string;
  databasePath: string;
  pm2AppName: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const REQUIRED_KEYS: Array<keyof Omit<AppConfig, 'environment' | 'databasePath' | 'pm2AppName'>> = [
  'token',
  'clientId',
  'guildId',
  'checkChannelId',
  'logChannelId',
  'resultChannelId',
  'voiceChannelId',
  'noticeChannelId',
  'vacancesRegisterChannelId',
  'testChannelId',
];

function resolveEnvironment(): AppEnvironment {
  const rawEnv = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'dev').toLowerCase();

  if (rawEnv === 'prod' || rawEnv === 'production') {
    return 'prod';
  }

  if (rawEnv === 'dev' || rawEnv === 'development' || rawEnv === 'test') {
    return 'dev';
  }

  throw new Error(`Unsupported APP_ENV/NODE_ENV "${rawEnv}". Use dev or prod.`);
}

function resolveConfigPath(environment: AppEnvironment) {
  const configuredPath = process.env.HARUHARU_CONFIG_PATH;
  const configPath = configuredPath
    ? path.resolve(projectRoot, configuredPath)
    : path.join(projectRoot, 'config', `${environment}.json`);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Create it from config/${environment}.example.json or set HARUHARU_CONFIG_PATH.`,
    );
  }

  return configPath;
}

function readRawConfig(configPath: string) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as RawAppConfig;
}

function requireString(rawConfig: RawAppConfig, key: keyof RawAppConfig) {
  const value = rawConfig[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required config key "${key}" in ${configPath}.`);
  }
  return value;
}

const environment = resolveEnvironment();
const configPath = resolveConfigPath(environment);
const rawConfig = readRawConfig(configPath);

if (rawConfig.environment && rawConfig.environment !== environment) {
  throw new Error(
    `Config environment mismatch: APP_ENV resolved to "${environment}" but config declares "${rawConfig.environment}".`,
  );
}

const requiredValues = REQUIRED_KEYS.reduce<Record<string, string>>((acc, key) => {
  acc[key] = requireString(rawConfig, key);
  return acc;
}, {});

function resolveProjectPath(relativeOrAbsolutePath: string) {
  if (relativeOrAbsolutePath === ':memory:' || relativeOrAbsolutePath.startsWith('file:')) {
    return relativeOrAbsolutePath;
  }

  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(projectRoot, relativeOrAbsolutePath);
}

export const appConfig: AppConfig = {
  environment,
  token: requiredValues.token,
  clientId: requiredValues.clientId,
  guildId: requiredValues.guildId,
  checkChannelId: requiredValues.checkChannelId,
  logChannelId: requiredValues.logChannelId,
  resultChannelId: requiredValues.resultChannelId,
  voiceChannelId: requiredValues.voiceChannelId,
  noticeChannelId: requiredValues.noticeChannelId,
  vacancesRegisterChannelId: requiredValues.vacancesRegisterChannelId,
  testChannelId: requiredValues.testChannelId,
  databasePath: resolveProjectPath(rawConfig.databasePath ?? path.join('data', `${environment}.sqlite`)),
  pm2AppName: rawConfig.pm2AppName ?? `haruharu-bot-${environment}`,
};

export { configPath, projectRoot };
