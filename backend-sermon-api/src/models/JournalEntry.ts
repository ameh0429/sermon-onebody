import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class JournalEntry extends Model<InferAttributes<JournalEntry>, InferCreationAttributes<JournalEntry>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare sermonId: CreationOptional<string | null>;
  declare title: string;
  declare content: string;
  /** Entries are private unless `isShared` is true AND `sharedWithGroupId` is set. */
  declare isShared: CreationOptional<boolean>;
  declare sharedWithGroupId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

JournalEntry.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    sermonId: { type: DataTypes.UUID, allowNull: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    isShared: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sharedWithGroupId: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'journal_entries',
    indexes: [
      { name: 'journal_entries_user_created_idx', fields: ['user_id', 'created_at'] },
      { name: 'journal_entries_sermon_idx', fields: ['sermon_id'] },
      { name: 'journal_entries_shared_group_idx', fields: ['shared_with_group_id'] },
    ],
  },
);
