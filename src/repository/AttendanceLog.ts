import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

const ATTENDANCE_LOG_STATUSES = ['attended', 'late', 'absent'] as const;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const YEAR_MONTH_DAY_PATTERN = /^\d{8}$/;
const isValidIsoTimestamp = (value: string) => {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const canonical = parsed.toISOString();
  return value === canonical || value === canonical.replace('.000Z', 'Z');
};
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

class AttendanceLog extends Model<
  InferAttributes<AttendanceLog, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<AttendanceLog, { omit: 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare yearmonthday: string;
  declare threadid: string;
  declare messageid: string;
  declare commentedat: string;
  declare status: (typeof ATTENDANCE_LOG_STATUSES)[number];
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AttendanceLog.init(
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
    username: {
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
    threadid: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    messageid: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    commentedat: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIsoTimestamp(value: string) {
          if (!isValidIsoTimestamp(value)) {
            throw new Error('commentedat must be an ISO-8601 UTC timestamp');
          }
        },
      },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [ATTENDANCE_LOG_STATUSES],
      },
    },
  },
  {
    sequelize,
    tableName: 'attendance_logs',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonthday'],
      },
    ],
  },
);

export { AttendanceLog, ATTENDANCE_LOG_STATUSES };
