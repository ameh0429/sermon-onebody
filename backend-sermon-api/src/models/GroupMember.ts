import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { GROUP_ROLES, type GroupRole } from '../types.js';

export class GroupMember extends Model<InferAttributes<GroupMember>, InferCreationAttributes<GroupMember>> {
  declare groupId: string;
  declare userId: string;
  declare role: CreationOptional<GroupRole>;
  declare createdAt: CreationOptional<Date>; // join date
  declare updatedAt: CreationOptional<Date>;
}

GroupMember.init(
  {
    groupId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    role: { type: DataTypes.ENUM(...GROUP_ROLES), allowNull: false, defaultValue: 'member' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'group_members',
    indexes: [{ name: 'group_members_user_idx', fields: ['user_id'] }],
  },
);
