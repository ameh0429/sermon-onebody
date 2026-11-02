/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List your currently accessible in-app notifications
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/Limit' }
 *       - { name: unread, in: query, schema: { type: boolean, default: false } }
 *     responses:
 *       200: { description: 'Paginated data: id, kind, title, target, readAt, createdAt; owner and current content access are enforced' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Count your accessible unread notifications
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 'data.count integer' }
 * /notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Read your notification preferences (all enabled by default)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 'data.sermons, data.plans, data.replies booleans' }
 *   patch:
 *     tags: [Notifications]
 *     summary: Save preferences for future notifications
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [sermons, plans, replies]
 *             properties:
 *               sermons: { type: boolean }
 *               plans: { type: boolean }
 *               replies: { type: boolean }
 *     responses:
 *       200: { description: Saved preferences }
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all your currently accessible notifications as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Remaining unread count }
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark one of your notifications as read (idempotent)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ $ref: '#/components/parameters/Id' }]
 *     responses:
 *       200: { description: Read notification ID }
 *       404: { description: Notification not found or inaccessible }
 */
import { Router } from "express";
import { QueryTypes } from "sequelize";
import { z } from "zod";
import { sequelize } from "../config/database.js";
import { NotificationPreference } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { currentUser, param, paginate, paginated } from "../utils/helpers.js";
import { AppError } from "../utils/AppError.js";
import { idParam } from "../validators/index.js";
import { visibleNotification, unreadCount } from "../services/notifications.js";
export const notificationRouter = Router();
notificationRouter.use(authenticate, (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
const prefs = z
  .object({ sermons: z.boolean(), plans: z.boolean(), replies: z.boolean() })
  .strict();
const query = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z.enum(["true", "false"]).default("false"),
});
notificationRouter.get("/unread-count", async (req, res) =>
  res.json({
    status: "success",
    data: {
      count: await unreadCount(
        currentUser(req).id,
        currentUser(req).role === "admin",
      ),
    },
  }),
);
notificationRouter.get("/preferences", async (req, res) => {
  const found = await NotificationPreference.findByPk(currentUser(req).id);
  res.json({
    status: "success",
    data: found
      ? { sermons: found.sermons, plans: found.plans, replies: found.replies }
      : { sermons: true, plans: true, replies: true },
  });
});
notificationRouter.patch(
  "/preferences",
  validate({ body: prefs }),
  async (req, res) => {
    const [found] = await NotificationPreference.upsert({
      userId: currentUser(req).id,
      ...req.body,
    });
    res.json({
      status: "success",
      data: {
        sermons: found.sermons,
        plans: found.plans,
        replies: found.replies,
      },
    });
  },
);
notificationRouter.patch("/read-all", async (req, res) => {
  await sequelize.query(
    `UPDATE notifications n SET read_at=now(),updated_at=now() WHERE ${visibleNotification} AND read_at IS NULL`,
    {
      replacements: {
        userId: currentUser(req).id,
        admin: currentUser(req).role === "admin",
      },
    },
  );
  res.json({
    status: "success",
    data: {
      count: await unreadCount(
        currentUser(req).id,
        currentUser(req).role === "admin",
      ),
    },
  });
});
notificationRouter.patch(
  "/:id/read",
  validate({ params: idParam }),
  async (req, res) => {
    const rows = await sequelize.query<{ id: string }>(
      `UPDATE notifications n SET read_at=COALESCE(read_at,now()),updated_at=now() WHERE ${visibleNotification} AND n.id=:id RETURNING id`,
      {
        replacements: {
          userId: currentUser(req).id,
          admin: currentUser(req).role === "admin",
          id: param(req, "id"),
        },
        type: QueryTypes.SELECT,
      },
    );
    if (!rows.length) throw AppError.notFound("Notification not found");
    res.json({ status: "success", data: { id: rows[0].id } });
  },
);
notificationRouter.get("/", validate({ query }), async (req, res) => {
  const { page, limit, unread } = req.query as unknown as z.infer<typeof query>;
  const { offset } = paginate(page, limit);
  const replacements = {
    userId: currentUser(req).id,
    admin: currentUser(req).role === "admin",
    limit,
    offset,
  };
  const where = `${visibleNotification}${unread === "true" ? " AND n.read_at IS NULL" : ""}`;
  const data = await sequelize.query<{
    id: string;
    kind: string;
    readAt: Date | null;
    createdAt: Date;
    title: string;
    target: string;
  }>(
    `SELECT n.id,n.kind,n.read_at AS "readAt",n.created_at AS "createdAt",
    CASE n.kind WHEN 'sermons' THEN 'New sermon: ' || s.title WHEN 'plans' THEN 'New study plan: ' || p.title ELSE 'Someone replied to your fellowship post' END AS title,
    CASE n.kind WHEN 'sermons' THEN '/sermons/' || n.sermon_id WHEN 'plans' THEN '/growth/' || n.study_plan_id ELSE '/groups/' || d.group_id || '?thread=' || d.parent_post_id END AS target
    FROM notifications n LEFT JOIN sermons s ON s.id=n.sermon_id LEFT JOIN study_plans p ON p.id=n.study_plan_id LEFT JOIN discussion_posts d ON d.id=n.post_id
    WHERE ${where} ORDER BY n.created_at DESC,n.id DESC LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT },
  );
  const [count] = await sequelize.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM notifications n WHERE ${where}`,
    { replacements, type: QueryTypes.SELECT },
  );
  res.json({ status: "success", ...paginated(data, count.count, page, limit) });
});
