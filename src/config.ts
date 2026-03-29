import { createRequire } from 'node:module';

export interface AppConfig {
  token?: string;
  clientId?: string;
  guildId?: string;
  databaseUser?: string;
  password?: string;
  noticeChannelId?: string;
  vacancesRegisterChannelId?: string;
  checkChannelId?: string;
  testChannelId?: string;
  logChannelId?: string;
  resultChannelId?: string;
  voiceChannelId?: string;
  startHereChannelId?: string;
  opsChannelId?: string;
  wakeUpRoleId?: string;
  camStudyRoleId?: string;
}

const jsonRequire = createRequire(import.meta.url);
export const config = jsonRequire('../config.json') as AppConfig;

const getRequiredConfig = (key: keyof AppConfig) => {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required configuration value for "${String(key)}" in config.json`);
  }
  return value;
};

const getOptionalConfig = (key: keyof AppConfig) => {
  const value = config[key];
  return typeof value === 'string' ? value : '';
};

export const token = getRequiredConfig('token');
export const clientId = getRequiredConfig('clientId');
export const guildId = getRequiredConfig('guildId');
export const databaseUser = getOptionalConfig('databaseUser');
export const password = getOptionalConfig('password');
export const noticeChannelId = getRequiredConfig('noticeChannelId');
export const vacancesRegisterChannelId = getRequiredConfig('vacancesRegisterChannelId');
export const checkChannelId = getRequiredConfig('checkChannelId');
export const testChannelId = getRequiredConfig('testChannelId');
export const logChannelId = getRequiredConfig('logChannelId');
export const resultChannelId = getRequiredConfig('resultChannelId');
export const voiceChannelId = getRequiredConfig('voiceChannelId');
export const startHereChannelId = getRequiredConfig('startHereChannelId');
export const opsChannelId = getRequiredConfig('opsChannelId');
export const wakeUpRoleId = getRequiredConfig('wakeUpRoleId');
export const camStudyRoleId = getRequiredConfig('camStudyRoleId');

export const commandChannelIds = new Set(
  [noticeChannelId, vacancesRegisterChannelId, checkChannelId, testChannelId, logChannelId].filter(Boolean),
);
