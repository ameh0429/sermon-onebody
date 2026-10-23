import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export class DiscussionPost extends Model<InferAttributes<DiscussionPost>, InferCreationAttributes<DiscussionPost>> {
  declare id: CreationOptional<string>;
  declare groupId: string;
  declare sermonId: CreationOptional<string | null>;
  declare authorId: string;
  declare parentPostId: CreationOptional<string | null>;
  declare content: string;
  declare isFlagged: CreationOptional<boolean>;
  declare flagReason: CreationOptional<string | null>;
  declare flaggedById: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

DiscussionPost.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    groupId: { type: DataTypes.UUID, allowNull: false },
    sermonId: { type: DataTypes.UUID, allowNull: true },
    authorId: { type: DataTypes.UUID, allowNull: false },
    parentPostId: { type: DataTypes.UUID, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    isFlagged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    flagReason: { type: DataTypes.STRING(500), allowNull: true },
    flaggedById: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'discussion_posts',
    indexes: [
      { name: 'discussion_posts_group_created_idx', fields: ['group_id', 'created_at'] },
      { name: 'discussion_posts_sermon_idx', fields: ['sermon_id'] },
      { name: 'discussion_posts_parent_idx', fields: ['parent_post_id'] },
      { name: 'discussion_posts_flagged_idx', fields: ['group_id', 'is_flagged'] },
    ],
  },
);
