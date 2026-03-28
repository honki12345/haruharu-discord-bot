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
}

const jsonRequire = createRequire(import.meta.url);
export const config = jsonRequire('../config.json') as AppConfig;

export const token = config.token ?? '';
export const clientId = config.clientId ?? '';
export const guildId = config.guildId ?? '';
export const databaseUser = config.databaseUser ?? '';
export const password = config.password ?? '';
export const noticeChannelId = config.noticeChannelId ?? '';
export const vacancesRegisterChannelId = config.vacancesRegisterChannelId ?? '';
export const checkChannelId = config.checkChannelId ?? '';
export const testChannelId = config.testChannelId ?? '';
export const logChannelId = config.logChannelId ?? '';
export const resultChannelId = config.resultChannelId ?? '';
export const voiceChannelId = config.voiceChannelId ?? '';

export const commandChannelIds = new Set(
  [noticeChannelId, vacancesRegisterChannelId, checkChannelId, testChannelId, logChannelId].filter(Boolean),
);
