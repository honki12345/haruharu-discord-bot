import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

const YEAR_MONTH_DAY_PATTERN = /^\d{8}$/;

const isValidYearMonthDay = (value: string) => {
  if (!YEAR_MONTH_DAY_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const date = Number(value.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, date));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === date;
};

class WaketimeChangeLog extends Model<
  InferAttributes<WaketimeChangeLog, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<WaketimeChangeLog, { omit: 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare yearmonthday: string;
  declare waketime: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

WaketimeChangeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    yearmonthday: {
      type: new DataTypes.STRING(8),
      allowNull: false,
      validate: {
        isCanonicalYearMonthDay(value: string) {
          if (!isValidYearMonthDay(value)) {
            throw new Error('yearmonthday must be a canonical yyyymmdd date');
          }
        },
      },
    },
    waketime: {
      type: new DataTypes.STRING(4),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'waketime_change_logs',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonthday'],
      },
    ],
  },
);

export { WaketimeChangeLog };
