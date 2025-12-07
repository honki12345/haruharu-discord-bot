import { sequelize } from './config.js';
import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

class TimeLog extends Model<InferAttributes<TimeLog>, InferCreationAttributes<TimeLog>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare checkintime: string | null;
  declare checkouttime: string | null;
  declare isintime: boolean;
}

TimeLog.init(
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
    yearmonthday: {
      type: DataTypes.STRING,
    },
    checkintime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    checkouttime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isintime: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    sequelize,
    tableName: 'time_logs',
  },
);

export { TimeLog };
