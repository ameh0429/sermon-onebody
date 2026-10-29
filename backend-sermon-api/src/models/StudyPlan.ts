import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class StudyPlan extends Model<InferAttributes<StudyPlan>, InferCreationAttributes<StudyPlan>> {
  declare id: CreationOptional<string>;
  declare sermonId: CreationOptional<string | null>;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

StudyPlan.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sermonId: { type: DataTypes.UUID, allowNull: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: 'study_plans', indexes: [{ fields: ['sermon_id'] }] });
