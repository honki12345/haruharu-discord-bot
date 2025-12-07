import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

class CamStudyUsers extends Model<InferAttributes<CamStudyUsers>, InferCreationAttributes<CamStudyUsers>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
}

// 'cam_study_users'
CamStudyUsers.init(
  {
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
  },
  {
    sequelize,
    tableName: 'cam_study_users',
  },
);

export { CamStudyUsers };
