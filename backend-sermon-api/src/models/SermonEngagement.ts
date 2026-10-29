import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

/** One row per user/sermon/event: repeated requests do not inflate engagement. */
export class SermonEngagement extends Model<InferAttributes<SermonEngagement>, InferCreationAttributes<SermonEngagement>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare sermonId: string;
  declare event: 'view' | 'listen';
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
SermonEngagement.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  sermonId: { type: DataTypes.UUID, allowNull: false },
  event: { type: DataTypes.ENUM('view', 'listen'), allowNull: false },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: 'sermon_engagements', indexes: [
  { unique: true, fields: ['user_id', 'sermon_id', 'event'] },
  { fields: ['sermon_id'] },
] });
