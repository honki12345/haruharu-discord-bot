const { Sequelize, DataType } = require('sequelize');
const { databaseUser, password } = require('../config.json');

const sequelize = new Sequelize('haruharu-database', databaseUser, password, {
  host: 'localhost',
  dialect: 'sqlite',
  // logging: console.log,
  // logQueryParameters: true,
  logging: false,
  storage: 'database.sqlite',
  query: { raw: true },
});

module.exports = {
  sequelize,
  Sequelize,
  DataType,
};
