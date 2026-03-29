import { createRequire } from 'node:module';
import type { AppConfig } from './config.js';

const jsonRequire = createRequire(import.meta.url);
const config = jsonRequire('../config.json') as AppConfig;

const getRequiredCommandConfig = (key: 'startHereChannelId' | 'testChannelId') => {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required configuration value for "${key}" in config.json`);
  }
  return value;
};

const getOptionalCommandConfig = (key: 'timeStartHereChannelId') => {
  const value = config[key];
  return typeof value === 'string' ? value : '';
};

export const startHereChannelId = getRequiredCommandConfig('startHereChannelId');
export const timeStartHereChannelId = getOptionalCommandConfig('timeStartHereChannelId') || startHereChannelId;
export const testChannelId = getRequiredCommandConfig('testChannelId');
