import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from './config.js';

class WakeUpMembership extends Model<InferAttributes<WakeUpMembership>, InferCreationAttributes<WakeUpMembership>> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare username: string;
  declare waketime: string | null;
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

export { WakeUpMembership };
