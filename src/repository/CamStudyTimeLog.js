const { sequelize, Sequelize } = require('./config');
const { DataTypes } = require('sequelize');

const CamStudyTimeLog = sequelize.define('cam_study_time_log', {
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
  timestamp: {
    type: DataTypes.STRING,
  },
  totalminutes: {
    type: DataTypes.INTEGER,
  },
});

module.exports = {
  CamStudyTimeLog,
};
