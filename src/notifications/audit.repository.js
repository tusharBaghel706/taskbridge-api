// Repository for AuditLog - immutable: no update/delete methods provided

module.exports = function makeAuditRepository({ models }) {
  const { AuditLog } = models;
  if (!AuditLog) throw new Error('AuditLog model required');

  return {
    async create(entry, options = {}) {
      // Expect entry to include tenant_id, event_type, entity_type, actor_organisation_id, new_state
      return AuditLog.create(entry, options);
    },

    async findByProject({ tenantId, projectId, from, to, eventType, limit = 100, offset = 0 }) {
      const where = { tenant_id: tenantId, entity_type: 'project', entity_id: projectId };
      if (eventType) where.event_type = eventType;
      if (from) where.timestamp = { ...(where.timestamp || {}), [models.Sequelize.Op.gte]: from };
      if (to) where.timestamp = { ...(where.timestamp || {}), [models.Sequelize.Op.lte]: to };

      return AuditLog.findAll({ where, limit, offset, order: [['timestamp', 'DESC']] });
    },
  };
};
