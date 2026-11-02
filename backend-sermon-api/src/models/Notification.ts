import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";
import { sequelize } from "../config/database.js";
export class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare kind: "sermons" | "plans" | "replies";
  declare eventKey: string;
  declare sermonId: CreationOptional<string | null>;
  declare studyPlanId: CreationOptional<string | null>;
  declare postId: CreationOptional<string | null>;
  declare readAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING(16), allowNull: false },
    eventKey: { type: DataTypes.STRING(80), allowNull: false },
    sermonId: { type: DataTypes.UUID, allowNull: true },
    studyPlanId: { type: DataTypes.UUID, allowNull: true },
    postId: { type: DataTypes.UUID, allowNull: true },
    readAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "notifications",
    indexes: [
      { unique: true, fields: ["user_id", "event_key"] },
      { fields: ["user_id", "created_at"] },
      { fields: ["user_id", "read_at"] },
    ],
  },
);
export class NotificationPreference extends Model<
  InferAttributes<NotificationPreference>,
  InferCreationAttributes<NotificationPreference>
> {
  declare userId: string;
  declare sermons: CreationOptional<boolean>;
  declare plans: CreationOptional<boolean>;
  declare replies: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
NotificationPreference.init(
  {
    userId: { type: DataTypes.UUID, primaryKey: true },
    sermons: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    plans: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    replies: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: "notification_preferences" },
);
