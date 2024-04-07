const { sequelize, Sequelize } = require('./config');
const { DataTypes } = require('sequelize');

const TimeLog = sequelize.define('time_log', {
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
  yearmonthday: {
    type: DataTypes.STRING,
  },
  checkintime: {
    type: DataTypes.STRING,
  },
  checkouttime: {
    type: DataTypes.STRING,
  },
  isintime: {
    type: DataTypes.BOOLEAN,
  },
});

module.exports = {
  TimeLog,
};
