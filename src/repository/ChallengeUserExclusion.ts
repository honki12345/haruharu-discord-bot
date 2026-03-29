import { sequelize } from './config.js';
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

class ChallengeUserExclusion extends Model<
  InferAttributes<ChallengeUserExclusion>,
  InferCreationAttributes<ChallengeUserExclusion>
> {
  declare id: CreationOptional<number>;
  declare userid: string;
  declare yearmonth: string;
}

ChallengeUserExclusion.init(
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
    yearmonth: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'challenge_user_exclusions',
    indexes: [
      {
        unique: true,
        fields: ['userid', 'yearmonth'],
      },
    ],
  },
);

export { ChallengeUserExclusion };
