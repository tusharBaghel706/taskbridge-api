const express = require('express');
const router = express.Router();

module.exports = function makeNotificationController({ notificationService }) {
  router.get('/notifications/:userId', async (req, res, next) => {
    try {
      const ctx = req.context || {};
      const tenantId = ctx.tenantId;
      const callerUserId = ctx.userId;
      const userId = req.params.userId;

      // Authorization: caller must request their own notifications
      if (!callerUserId || callerUserId !== userId) {
        const err = new Error('Forbidden');
        err.status = 403;
        return next(err);
      }

      const items = await notificationService.getUnreadForUser({ tenantId, userId });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/notifications/:id/read', async (req, res, next) => {
    try {
      const tenantId = (req.context || {}).tenantId;
      const id = req.params.id;
      await notificationService.markAsRead({ tenantId, notificationId: id });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};