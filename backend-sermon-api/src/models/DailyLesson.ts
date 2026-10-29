import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class DailyLesson extends Model<InferAttributes<DailyLesson>, InferCreationAttributes<DailyLesson>> {
  declare id: CreationOptional<string>;
  declare studyPlanId: string;
  declare day: number;
  declare title: string;
  declare passage: CreationOptional<string | null>;
  declare content: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

DailyLesson.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studyPlanId: { type: DataTypes.UUID, allowNull: false },
  day: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 7 } },
  title: { type: DataTypes.STRING(255), allowNull: false },
  passage: { type: DataTypes.STRING(150), allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: 'daily_lessons', indexes: [{ unique: true, fields: ['study_plan_id', 'day'] }] });
