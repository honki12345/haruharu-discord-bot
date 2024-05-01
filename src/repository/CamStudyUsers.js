const { sequelize } = require('./config');
const { DataTypes } = require('sequelize');

const CamStudyUsers = sequelize.define('cam_study_users', {
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
});

module.exports = {
  CamStudyUsers,
};
