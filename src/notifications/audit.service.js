const { z } = require('zod');

const auditSchema = z.object({
  event_type: z.enum(['MILESTONE_CREATED', 'MILESTONE_UPDATED', 'MILESTONE_DELETED']),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid().optional(),
  actor_user_id: z.string().uuid().optional(),
  actor_organisation_id: z.string().uuid(),
  previous_state: z.optional(z.any()),
  new_state: z.any(),
  // timestamp removed — server will set timestamp
});

module.exports = function makeAuditService({ repository, logger }) {
  if (!repository) throw new Error('audit repository required');

  async function createAuditEntry({ tenantId, data }) {
    const parsed = auditSchema.parse(data);

    // enforce actor organisation matches authenticated tenant
    if (parsed.actor_organisation_id !== tenantId) {
      const err = new Error('actor organisation does not match authenticated tenant');
      err.status = 403;
      throw err;
    }

    // enforce tenant scoping via tenantId param and set server-side timestamp
    const entry = Object.assign({}, parsed, { tenant_id: tenantId, timestamp: new Date() });

    // immutable audit entries: only create allowed
    return repository.create(entry);
  }

  async function getAuditHistory({ tenantId, projectId, from, to, eventType }) {
    return repository.findByProject({ tenantId, projectId, from, to, eventType });
  }

  // Explicit immutability guards — always throw to prevent accidental mutations
  async function updateAuditEntry() {
    throw new Error('Audit entries are immutable and cannot be modified or deleted');
  }

  async function deleteAuditEntry() {
    throw new Error('Audit entries are immutable and cannot be modified or deleted');
  }

  return { createAuditEntry, getAuditHistory, updateAuditEntry, deleteAuditEntry };
};