const { sequelize} = require('./config');
const { DataTypes } = require('sequelize');

const Users = sequelize.define('users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userid: {
    type: DataTypes.STRING,
  },
  username: {
    type: DataTypes.STRING,
  },
  yearmonth: {
    type: DataTypes.STRING,
  },
  waketime: {
    type: DataTypes.STRING,
  },
  vacances: {
    type: DataTypes.INTEGER,
  },
  latecount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  absencecount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = {
  Users,
};
