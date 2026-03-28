import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

const ATTENDANCE_LOG_STATUSES = ['attended', 'late', 'absent'] as const;

class AttendanceLog extends Model<InferAttributes<AttendanceLog>, InferCreationAttributes<AttendanceLog>> {
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
