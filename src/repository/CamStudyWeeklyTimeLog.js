const { sequelize, Sequelize } = require('./config');
const { DataTypes } = require('sequelize');

const CamStudyWeeklyTimeLog = sequelize.define('cam_study_weekly_time_log', {
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
  weektimes: {
    type: DataTypes.STRING,
  },
  totalminutes: {
    type: DataTypes.INTEGER,
  },
});

module.exports = {
  CamStudyWeeklyTimeLog
};
