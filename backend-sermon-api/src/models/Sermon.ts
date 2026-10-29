import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Sermon extends Model<InferAttributes<Sermon>, InferCreationAttributes<Sermon>> {
  declare id: CreationOptional<string>;
  declare status: CreationOptional<'draft' | 'published' | 'archived'>;
  declare title: string;
  declare preacher: string;
  declare passage: string;
  declare sermonDate: string; // YYYY-MM-DD
  declare summary: CreationOptional<string | null>;
  declare content: CreationOptional<string | null>;
  declare audioUrl: CreationOptional<string | null>;
  declare videoUrl: CreationOptional<string | null>;
  declare tags: CreationOptional<string[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Sermon.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'published' },
    title: { type: DataTypes.STRING(255), allowNull: false },
    preacher: { type: DataTypes.STRING(150), allowNull: false },
    passage: { type: DataTypes.STRING(150), allowNull: false },
    sermonDate: { type: DataTypes.DATEONLY, allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: true },
    audioUrl: { type: DataTypes.STRING(2048), allowNull: true },
    videoUrl: { type: DataTypes.STRING(2048), allowNull: true },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'sermons',
    indexes: [
      { name: 'sermons_sermon_date_idx', fields: ['sermon_date'] },
      { name: 'sermons_preacher_idx', fields: ['preacher'] },
      { name: 'sermons_passage_idx', fields: ['passage'] },
      { name: 'sermons_tags_gin_idx', fields: ['tags'], using: 'GIN' },
    ],
  },
);
