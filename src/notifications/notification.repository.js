// Repository for Notification

module.exports = function makeNotificationRepository({ models }) {
  const { Notification } = models;
  if (!Notification) throw new Error('Notification model required');

  return {
    async create(notification, options = {}) {
      return Notification.create(notification, options);
    },

    async findUnreadForUser({ tenantId, userId, limit = 100, offset = 0 }) {
      const where = { tenant_id: tenantId, recipient_user_id: userId, read_status: false };
      return Notification.findAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    },

    async markAsRead({ tenantId, notificationId }, options = {}) {
      return Notification.update({ read_status: true }, { where: { id: notificationId, tenant_id: tenantId }, ...options });
    },
  };
};
