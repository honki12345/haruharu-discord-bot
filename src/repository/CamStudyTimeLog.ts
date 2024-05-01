import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

class CamStudyTimeLog extends Model<InferAttributes<CamStudyTimeLog>, InferCreationAttributes<CamStudyTimeLog>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare timestamp: string;
  declare totalminutes: number;
}

// 'cam_study_time_log'
CamStudyTimeLog.init({
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
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'cam_study_time_log',
  },
);

export {
  CamStudyTimeLog,
};
