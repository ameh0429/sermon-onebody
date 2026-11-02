import { QueryTypes, type Transaction } from "sequelize";
import { sequelize } from "../config/database.js";
import { StudyPlan, Sermon } from "../models/index.js";

// Fan-out is in the content transaction: notification failure rolls back the action.
// A unique event key prevents duplicate alerts on edits, reattachments and republication.
async function deliver(
  kind: "sermons" | "plans" | "replies",
  source: string,
  actor: string,
  transaction: Transaction,
  recipient: string | null = null,
) {
  const column = {
    sermons: "sermon_id",
    plans: "study_plan_id",
    replies: "post_id",
  }[kind];
  await sequelize.query(
    `INSERT INTO notifications (id,user_id,kind,event_key,${column},created_at,updated_at)
    SELECT gen_random_uuid(),u.id,:kind,:event,:source,now(),now() FROM users u
    LEFT JOIN notification_preferences p ON p.user_id=u.id
    WHERE u.is_active=true AND u.id<>:actor AND COALESCE(p.${kind},true)=true
      AND (:recipient::uuid IS NULL OR u.id=:recipient::uuid)
      AND (:kind <>'replies' OR EXISTS (
        SELECT 1 FROM discussion_posts d JOIN fellowship_groups g ON g.id=d.group_id
        WHERE d.id=:source AND (u.role='admin' OR g.leader_id=u.id OR EXISTS
          (SELECT 1 FROM group_members m WHERE m.group_id=g.id AND m.user_id=u.id))))
    ON CONFLICT (user_id,event_key) DO NOTHING`,
    {
      replacements: {
        kind,
        event: `${kind}:${source}`,
        source,
        actor,
        recipient,
      },
      transaction,
    },
  );
}
export async function notifyPlan(
  id: string,
  actor: string,
  transaction: Transaction,
) {
  const plan = await StudyPlan.findByPk(id, { transaction });
  if (
    plan?.sermonId &&
    (await Sermon.findOne({
      where: { id: plan.sermonId, status: "published" },
      transaction,
    }))
  )
    await deliver("plans", id, actor, transaction);
}
export async function notifySermon(
  id: string,
  actor: string,
  transaction: Transaction,
) {
  await deliver("sermons", id, actor, transaction);
  for (const plan of await StudyPlan.findAll({
    where: { sermonId: id },
    transaction,
  }))
    await notifyPlan(plan.id, actor, transaction);
}
export async function notifyReply(
  id: string,
  recipient: string,
  actor: string,
  transaction: Transaction,
) {
  await deliver("replies", id, actor, transaction, recipient);
}
// Always re-check current visibility, including counts and read mutations. No private
// discussion excerpt or cached title is retained after membership/content changes.
export const visibleNotification = `n.user_id=:userId AND (
 (n.kind='sermons' AND EXISTS (SELECT 1 FROM sermons s WHERE s.id=n.sermon_id AND s.status='published')) OR
 (n.kind='plans' AND EXISTS (SELECT 1 FROM study_plans p JOIN sermons s ON s.id=p.sermon_id WHERE p.id=n.study_plan_id AND s.status='published')) OR
 (n.kind='replies' AND EXISTS (SELECT 1 FROM discussion_posts d JOIN fellowship_groups g ON g.id=d.group_id WHERE d.id=n.post_id AND
 (:admin = true OR g.leader_id=:userId OR EXISTS (SELECT 1 FROM group_members m WHERE m.group_id=g.id AND m.user_id=:userId))))
)`;
export async function unreadCount(userId: string, admin: boolean) {
  const [result] = await sequelize.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM notifications n WHERE ${visibleNotification} AND n.read_at IS NULL`,
    { replacements: { userId, admin }, type: QueryTypes.SELECT },
  );
  return result.count;
}
