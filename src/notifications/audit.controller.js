const express = require('express');
const router = express.Router();

module.exports = function makeAuditController({ auditService }) {
  router.post('/audit', async (req, res, next) => {
    try {
      const ctx = req.context || {};
      const tenantId = ctx.tenantId;
      const data = req.body;
      const created = await auditService.createAuditEntry({ tenantId, data });
      res.status(201).json({ id: created.id, timestamp: created.timestamp });
    } catch (err) {
      next(err);
    }
  });

  router.get('/audit/:projectId', async (req, res, next) => {
    try {
      const tenantId = (req.context || {}).tenantId;
      const projectId = req.params.projectId;
      const from = req.query.from;
      const to = req.query.to;
      const eventType = req.query.eventType;
      const items = await auditService.getAuditHistory({ tenantId, projectId, from, to, eventType });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
