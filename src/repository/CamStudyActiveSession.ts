import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

class CamStudyActiveSession extends Model<
  InferAttributes<CamStudyActiveSession>,
  InferCreationAttributes<CamStudyActiveSession>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare channelid: string;
  declare startedat: string;
  declare lastobservedat: string;
}

CamStudyActiveSession.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: DataTypes.STRING,
      unique: true,
    },
    username: {
      type: DataTypes.STRING,
    },
    channelid: {
      type: DataTypes.STRING,
    },
    startedat: {
      type: DataTypes.STRING,
    },
    lastobservedat: {
      type: DataTypes.STRING,
    },
  },
  {
    sequelize,
    tableName: 'cam_study_active_sessions',
  },
);

export { CamStudyActiveSession };
