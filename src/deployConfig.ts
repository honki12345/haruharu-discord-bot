import { createRequire } from 'node:module';
import type { AppConfig } from './config.js';

const jsonRequire = createRequire(import.meta.url);
const config = jsonRequire('../config.json') as AppConfig;

const getRequiredDeployConfig = (key: 'token' | 'clientId' | 'guildId') => {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required configuration value for "${key}" in config.json`);
  }
  return value;
};

export const token = getRequiredDeployConfig('token');
export const clientId = getRequiredDeployConfig('clientId');
export const guildId = getRequiredDeployConfig('guildId');
