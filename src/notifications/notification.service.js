const { z } = require('zod');

const createNotificationSchema = z.object({
  recipient_user_id: z.string().uuid(),
  event_type: z.string().min(1),
  project_id: z.string().uuid().optional(),
  message: z.string().min(1),
});

module.exports = function makeNotificationService({ repository, auditService, logger, models }) {
  if (!repository) throw new Error('notification repository required');
  const sequelize = models && models.sequelize;
  if (!sequelize) throw new Error('sequelize instance required in models');

  async function createNotificationsForTeam({ tenantId, teamMemberIds, eventType, projectId, message }) {
    const created = [];

    // Create all notifications in a single transaction so the batch is atomic.
    await sequelize.transaction(async (t) => {
      for (const userId of teamMemberIds) {
        const payload = {
          tenant_id: tenantId,
          recipient_user_id: userId,
          event_type: eventType,
          project_id: projectId || null,
          message,
        };
        const parsed = createNotificationSchema.parse(payload);
        const n = await repository.create(parsed, { transaction: t });
        created.push(n);
      }
    });

    // NOTE: audit entries for milestone changes are written by the Project Service via POST /audit.
    // Do not emit audit entries from here to avoid duplication.

    return created;
  }

  async function getUnreadForUser({ tenantId, userId }) {
    return repository.findUnreadForUser({ tenantId, userId });
  }

  async function markAsRead({ tenantId, notificationId }) {
    return repository.markAsRead({ tenantId, notificationId });
  }

  return { createNotificationsForTeam, getUnreadForUser, markAsRead };
};