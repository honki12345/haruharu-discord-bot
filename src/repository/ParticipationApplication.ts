import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from './config.js';

class ParticipationApplication extends Model<
  InferAttributes<ParticipationApplication>,
  InferCreationAttributes<ParticipationApplication>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare program: 'wake-up' | 'cam-study';
  declare status: 'pending' | 'approved' | 'rejected';
  declare reason: string | null;
}

ParticipationApplication.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userid: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    program: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [['wake-up', 'cam-study']],
      },
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [['pending', 'approved', 'rejected']],
      },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'participation_applications',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'program'],
      },
    ],
  },
);

export { ParticipationApplication };
