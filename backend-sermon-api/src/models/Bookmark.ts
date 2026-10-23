import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Bookmark extends Model<InferAttributes<Bookmark>, InferCreationAttributes<Bookmark>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare sermonId: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Bookmark.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    sermonId: { type: DataTypes.UUID, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'bookmarks',
    indexes: [
      { name: 'bookmarks_user_sermon_unique', unique: true, fields: ['user_id', 'sermon_id'] },
      { name: 'bookmarks_user_created_idx', fields: ['user_id', 'created_at'] },
    ],
  },
);
