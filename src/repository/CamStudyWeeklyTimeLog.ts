import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

class CamStudyWeeklyTimeLog extends Model<InferAttributes<CamStudyWeeklyTimeLog>, InferCreationAttributes<CamStudyWeeklyTimeLog>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare weektimes: number;
  declare totalminutes: number;
}

// 'cam_study_weekly_time_log'
CamStudyWeeklyTimeLog.init({
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
      type: DataTypes.INTEGER,
    },
    totalminutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'cam_study_weekly_time_logs',
  });

export {
  CamStudyWeeklyTimeLog,
};
