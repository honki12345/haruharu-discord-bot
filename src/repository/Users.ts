import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { DEFAULT_VACANCES_COUNT } from '../utils.js';

class Users extends Model<InferAttributes<Users>, InferCreationAttributes<Users>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonth: string;
  declare waketime: string;
  declare vacances: number;
  declare latecount: number;
  declare absencecount: number;
}

Users.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userid: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    username: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    yearmonth: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    waketime: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    vacances: {
      type: DataTypes.INTEGER,
      defaultValue: DEFAULT_VACANCES_COUNT,
    },
    latecount: {
      type: DataTypes.INTEGER,
    },
    absencecount: {
      type: DataTypes.INTEGER,
    },
  },
  {
    sequelize,
    tableName: 'users',
  },
);

export { Users };
