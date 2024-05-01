import { Sequelize, DataType } from 'sequelize';
import { createRequire } from 'node:module';

const jsonRequire = createRequire(import.meta.url);
const config = jsonRequire('../../config.json');

const sequelize = new Sequelize('haruharu-database', config.databaseUser, config.password, {
  host: 'localhost',
  dialect: 'sqlite',
  // logging: console.log,
  // logQueryParameters: true,
  logging: false,
  storage: 'database.sqlite',
  query: { raw: true },
});

export {
  sequelize,
  Sequelize,
  DataType,
};
