import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class LessonProgress extends Model<InferAttributes<LessonProgress>, InferCreationAttributes<LessonProgress>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare dailyLessonId: string;
  declare completed: CreationOptional<boolean>;
  declare completedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

LessonProgress.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  dailyLessonId: { type: DataTypes.UUID, allowNull: false },
  completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: 'lesson_progress', indexes: [{ unique: true, fields: ['user_id', 'daily_lesson_id'] }, { fields: ['daily_lesson_id'] }] });
