import { Sequelize, DataType } from 'sequelize';
import { databaseUser, password } from '../config.js';

const sequelize = new Sequelize('haruharu-database', databaseUser, password, {
  host: 'localhost',
  dialect: 'sqlite',
  // logging: console.log,
  // logQueryParameters: true,
  logging: false,
  storage: 'database.sqlite',
  query: { raw: true },
});

export { sequelize, Sequelize, DataType };
