const makeNotificationService = require('../src/notifications/notification.service');
const makeAuditService = require('../src/notifications/audit.service');

describe('Notification & Audit services (unit tests with mocked repositories)', () => {
  test('createNotificationsForTeam creates one notification per member (3 members)', async () => {
    const createdRecords = [];
    const repo = {
      create: jest.fn(async (payload, options = {}) => {
        const rec = Object.assign({ id: `notif-${createdRecords.length + 1}` }, payload);
        // capture transaction option for assertions
        rec._tx = options.transaction || null;
        createdRecords.push(rec);
        return rec;
      }),
      findUnreadForUser: jest.fn(),
      markAsRead: jest.fn(),
    };

    const models = {
      sequelize: {
        transaction: async (cb) => {
          const t = { LOCK: { UPDATE: 'UPDATE' } };
          return cb(t);
        },
      },
    };

    const service = makeNotificationService({ repository: repo, auditService: null, logger: console, models });

    // valid v4-style UUIDs (consistent per logical entity)
    const teamMemberIds = [
      '77777777-7777-4777-8777-777777777771',
      '77777777-7777-4777-8777-777777777772',
      '77777777-7777-4777-8777-777777777773',
    ];
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const projectId = '33333333-3333-4333-8333-333333333333';

    const created = await service.createNotificationsForTeam({
      tenantId,
      teamMemberIds,
      eventType: 'MILESTONE_CREATED',
      projectId,
      message: 'test',
    });

    expect(created).toHaveLength(3);
    expect(repo.create).toHaveBeenCalledTimes(3);
    // Check each created record corresponds to member
    expect(created.map((c) => c.recipient_user_id)).toEqual(teamMemberIds);
    // Ensure created records were created inside a transaction (our mock attached _tx)
    expect(created.every((c) => c._tx !== null)).toBe(true);
  });

  test('createAuditEntry writes audit record with correct fields and server timestamp', async () => {
    const created = [];
    const repo = {
      create: jest.fn(async (entry) => {
        created.push(entry);
        return Object.assign({ id: 'audit-1' }, entry);
      }),
      findByProject: jest.fn(),
    };

    const svc = makeAuditService({ repository: repo, logger: console });

    const tenantId = '11111111-1111-4111-8111-111111111111';
    const payload = {
      event_type: 'MILESTONE_UPDATED',
      entity_type: 'project',
      entity_id: '33333333-3333-4333-8333-333333333333',
      actor_user_id: '66666666-6666-4666-8666-666666666666',
      actor_organisation_id: tenantId,
      previous_state: { title: 'v1' },
      new_state: { title: 'v2' },
    };

    const result = await svc.createAuditEntry({ tenantId, data: payload });

    expect(repo.create).toHaveBeenCalledTimes(1);
    const saved = created[0];
    expect(saved.event_type).toBe(payload.event_type);
    expect(saved.entity_id).toBe(payload.entity_id);
    expect(saved.previous_state).toEqual(payload.previous_state);
    expect(saved.new_state).toEqual(payload.new_state);
    expect(saved.tenant_id).toBe(tenantId);
    expect(saved.timestamp).toBeInstanceOf(Date);
    expect(result.id).toBe('audit-1');
  });

  test('updateAuditEntry and deleteAuditEntry always throw immutability error', async () => {
    const repo = { create: jest.fn(), findByProject: jest.fn() };
    const svc = makeAuditService({ repository: repo, logger: console });

    await expect(svc.updateAuditEntry()).rejects.toThrow(/Audit entries are immutable/);
    await expect(svc.deleteAuditEntry()).rejects.toThrow(/Audit entries are immutable/);
  });

  test('getAuditHistory with from/to range returns only entries within range', async () => {
    // prepare sample entries (use UUIDs for tenant_id and entity_id)
    const base = new Date('2026-01-01T00:00:00Z');
    const entries = [
      { id: 'a1', tenant_id: '11111111-1111-4111-8111-111111111111', entity_type: 'project', entity_id: '33333333-3333-4333-8333-333333333333', event_type: 'MILESTONE_CREATED', timestamp: new Date(base.getTime() + 1000 * 60) },
      { id: 'a2', tenant_id: '11111111-1111-4111-8111-111111111111', entity_type: 'project', entity_id: '33333333-3333-4333-8333-333333333333', event_type: 'MILESTONE_UPDATED', timestamp: new Date(base.getTime() + 1000 * 60 * 60) },
      { id: 'a3', tenant_id: '11111111-1111-4111-8111-111111111111', entity_type: 'project', entity_id: '33333333-3333-4333-8333-333333333333', event_type: 'MILESTONE_DELETED', timestamp: new Date(base.getTime() + 1000 * 60 * 60 * 24) },
    ];

    const repo = {
      findByProject: jest.fn(async ({ tenantId, projectId, from, to, eventType }) => {
        return entries.filter((e) => {
          if (e.tenant_id !== tenantId) return false;
          if (projectId && e.entity_id !== projectId) return false;
          if (from && e.timestamp < new Date(from)) return false;
          if (to && e.timestamp > new Date(to)) return false;
          if (eventType && e.event_type !== eventType) return false;
          return true;
        });
      }),
    };

    const svc = makeAuditService({ repository: repo, logger: console });

    const from = new Date(base.getTime() + 1000 * 60 * 30).toISOString(); // between a1 and a2
    const to = new Date(base.getTime() + 1000 * 60 * 60 * 12).toISOString(); // between a2 and a3

    const items = await svc.getAuditHistory({ tenantId: '11111111-1111-4111-8111-111111111111', projectId: '33333333-3333-4333-8333-333333333333', from, to });
    // should include only a2
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('a2');
  });

  test('getAuditHistory with eventType filter only returns matching entries', async () => {
    const entries = [
      { id: 'b1', tenant_id: '11111111-1111-4111-8111-111111111111', entity_type: 'project', entity_id: '33333333-3333-4333-8333-444444444444', event_type: 'MILESTONE_CREATED', timestamp: new Date() },
      { id: 'b2', tenant_id: '11111111-1111-4111-8111-111111111111', entity_type: 'project', entity_id: '33333333-3333-4333-8333-444444444444', event_type: 'MILESTONE_UPDATED', timestamp: new Date() },
    ];

    const repo = {
      findByProject: jest.fn(async ({ tenantId, projectId, from, to, eventType }) => {
        return entries.filter((e) => e.tenant_id === tenantId && (!eventType || e.event_type === eventType));
      }),
    };

    const svc = makeAuditService({ repository: repo, logger: console });

    const items = await svc.getAuditHistory({ tenantId: '11111111-1111-4111-8111-111111111111', projectId: '33333333-3333-4333-8333-444444444444', eventType: 'MILESTONE_UPDATED' });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('b2');
  });

  test("tenant isolation: a different tenant's call returns no results", async () => {
    const entries = [
      { id: 'c1', tenant_id: '11111111-1111-4111-8111-111111111111', entity_type: 'project', entity_id: '33333333-3333-4333-8333-555555555555', event_type: 'MILESTONE_CREATED', timestamp: new Date() },
    ];

    const repo = {
      findByProject: jest.fn(async ({ tenantId, projectId }) => entries.filter((e) => e.tenant_id === tenantId && e.entity_id === projectId)),
    };

    const svc = makeAuditService({ repository: repo, logger: console });

    // caller from tenantB asking for tenantA's project should get no results
    const items = await svc.getAuditHistory({ tenantId: '22222222-2222-4222-8222-222222222222', projectId: '33333333-3333-4333-8333-555555555555' });
    expect(items).toHaveLength(0);
  });
});