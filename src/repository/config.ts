import { Sequelize, DataType } from 'sequelize';
import { appConfig } from '../config.js';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  logging: false,
  storage: appConfig.databasePath,
  query: { raw: true },
});

export { sequelize, Sequelize, DataType };
