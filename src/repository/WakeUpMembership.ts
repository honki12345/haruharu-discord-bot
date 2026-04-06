import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  QueryTypes,
  type Transaction,
} from 'sequelize';
import { sequelize } from './config.js';

class WakeUpMembership extends Model<InferAttributes<WakeUpMembership>, InferCreationAttributes<WakeUpMembership>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare waketime: string;
  declare attendancestreak: CreationOptional<number>;
  declare attendancestreakupdatedon: CreationOptional<string | null>;
  declare status: 'active' | 'stopped';
  declare stoppedat: string | null;
}

WakeUpMembership.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userid: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    waketime: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    attendancestreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    attendancestreakupdatedon: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [['active', 'stopped']],
      },
    },
    stoppedat: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'wake_up_memberships',
  },
);

const ensureWakeUpMembershipStreakColumns = async (transaction?: Transaction) => {
  const columns = await sequelize.query<{ name: string }>('PRAGMA table_info("wake_up_memberships")', {
    transaction,
    type: QueryTypes.SELECT,
  });
  const columnNames = new Set(columns.map(column => column.name));

  if (!columnNames.has('attendancestreak')) {
    await sequelize.query(
      'ALTER TABLE "wake_up_memberships" ADD COLUMN "attendancestreak" INTEGER NOT NULL DEFAULT 0',
      {
        transaction,
      },
    );
  }

  if (!columnNames.has('attendancestreakupdatedon')) {
    await sequelize.query('ALTER TABLE "wake_up_memberships" ADD COLUMN "attendancestreakupdatedon" TEXT', {
      transaction,
    });
  }
};

export { WakeUpMembership, ensureWakeUpMembershipStreakColumns };
