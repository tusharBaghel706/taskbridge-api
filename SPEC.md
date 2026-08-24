# Notification & Audit Service — SPEC

## Overview
Provide an append-only AuditLog and a Notification service for multi-tenant Project operations. The AuditLog is immutable (no updates/deletes). Notifications support lifecycle status changes (pending, sent, delivered, failed, read). All operations must enforce tenant isolation and strong authorization. The service exposes APIs for creating audit entries, creating notifications, updating notification status, and querying audit logs and notifications.

## Data Models

### AuditLog (immutable)
- Purpose: permanent, tamper-evident record of actions across services.
- Sequelize model name: AuditLog
- Columns:
  - id: UUID PRIMARY KEY (v4)
  - tenant_id: UUID NOT NULL
  - actor_id: UUID NULL (user/service initiating the action)
  - actor_type: ENUM('user','service','system') NOT NULL
  - action: STRING NOT NULL (e.g., "project.created", "project.updated")
  - resource_type: STRING NOT NULL (e.g., "project", "task")
  - resource_id: UUID NULL
  - metadata: JSONB NULL (structured context; avoid PII unless required and encrypted)
  - checksum: STRING NOT NULL (HMAC or SHA256 over record for tamper-evidence)
  - created_at: TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
- Indexes:
  - (tenant_id, created_at DESC)
  - (tenant_id, resource_type, resource_id)
  - (tenant_id, action)
- Immutability enforcement:
  - Application-level: only INSERT allowed for this model.
  - DB-level: revoke UPDATE/DELETE for app DB role or add DB triggers that prevent UPDATE/DELETE; maintain append-only guard.
  - Tamper-evidence: compute checksum on insert; store separately for periodic verification.

### Notification
- Purpose: deliver notifications and track their lifecycle.
- Sequelize model name: Notification
- Columns:
  - id: UUID PRIMARY KEY
  - tenant_id: UUID NOT NULL
  - recipient_id: UUID NOT NULL
  - channel: ENUM('email','in_app','push','sms','webhook') NOT NULL
  - template_id: STRING NULL
  - payload: JSONB NOT NULL (rendered content or templating context)
  - status: ENUM('pending','sent','delivered','failed','read') NOT NULL DEFAULT 'pending'
  - attempts: INTEGER NOT NULL DEFAULT 0
  - last_error: TEXT NULL
  - sent_at: TIMESTAMP NULL
  - delivered_at: TIMESTAMP NULL
  - created_at: TIMESTAMP NOT NULL DEFAULT now()
  - updated_at: TIMESTAMP NOT NULL DEFAULT now()
- Indexes:
  - (tenant_id, recipient_id)
  - (tenant_id, status, created_at)
- Constraints:
  - tenant_id and recipient_id immutable after create (enforced at app level).
  - status and timestamps may change per lifecycle; history can be recorded in AuditLog.

## API Contracts

Security common rules:
- Do NOT accept tenant_id from clients. Derive tenant from authenticated token, subdomain, or signed session.
- Require authentication (JWT or mTLS service tokens). JWT must include tenant_id claim and actor info.
- All endpoints must validate RBAC/ABAC in services.

1) Create Audit Entry
- POST /internal/audit
- Auth: service-token OR internal client JWT with tenant claim.
- Request payload:
  {
    "action": "project.created",
    "resource_type": "project",
    "resource_id": "uuid",
    "actor_id": "uuid",
    "actor_type": "user|service|system",
    "metadata": { ... }
  }
- Behavior:
  - Server derives tenant_id from token.
  - Compute checksum = HMAC(secret, <canonicalized payload>).
  - INSERT into AuditLog.
- Response: 201 Created
  {
    "id": "uuid",
    "created_at": "...",
    "tenant_id": "derived",
    "checksum": "..."
  }
- Errors:
  - 401 Unauthorized, 403 Forbidden, 422 Validation

2) Query Audit Entries
- GET /audit
- Auth: tenant-scoped JWT with appropriate role (e.g., admin/auditor) or authenticated service with tenant scope.
- Query params (all optional):
  - resource_type, resource_id, action, actor_id
  - from (ISO timestamp), to (ISO timestamp)
  - page_size (max 100), cursor (opaque)
- Behavior:
  - Derive tenant_id from token; only return entries for that tenant.
  - Enforce RBAC (tenant admins / auditors).
- Response: 200
  {
    "items": [ AuditLogRecord, ... ],
    "meta": { "next_cursor": "...", "page_size": N }
  }

3) Create Notification
- POST /notifications
- Auth: service or tenant user authorized to create notifications.
- Request payload:
  {
    "recipient_id": "uuid",
    "channel": "email|in_app|push|sms|webhook",
    "template_id": "string",
    "payload": { ... }
  }
- Behavior:
  - Derive tenant_id from token.
  - Validate recipient belongs to tenant.
  - Insert Notification with status 'pending'.
  - Optionally enqueue delivery job (internal queue).
  - Emit an AuditLog entry for notification.create.
- Response: 201 { "id": "uuid", "status": "pending", "created_at": "..." }

4) Get Notification / Update Status
- GET /notifications/{id} (tenant-scoped)
- PATCH /notifications/{id}/status
  - Body: { "status": "delivered|failed|read", "delivered_at": "...", "last_error": "..." }
- Auth: only tenant services or recipient (for read) or system workers.
- Behavior:
  - Only allow status transitions defined in business rules.
  - Record each status transition in AuditLog (immutable).
- Response: 200 updated Notification

Pagination, filtering, and rate-limiting apply to list endpoints.

## Integration Points
- Project Service:
  - On project lifecycle events (create/update/delete), emit events to Notification & Audit Service (recommended: async via message broker such as Kafka/RabbitMQ). Synchronous HTTP allowed for critical ops but prefer async.
  - Use service-to-service auth (JWT with service role or mTLS). Tokens must include tenant_id.
- Delivery workers:
  - Consume Notification queue, update Notification.status and timestamps, write AuditLog entries for delivery/failure events.
- Webhooks:
  - Allow tenant-configured webhooks for notifications; sign outbound webhooks and record webhook sends in AuditLog.
- DB:
  - Shared-schema: use tenant_id on every query; use repository helpers that auto-scope tenant.
  - Schema-per-tenant: ensure connection is bound to tenant schema before queries.

## Constraints
- Tenant isolation:
  - Never accept tenant_id from client payloads.
  - All DB queries must include tenant_id filter or use tenant-bound connection.
  - Deny cross-tenant queries; add tests asserting enforcement.
- Immutability:
  - AuditLog must be append-only: no UPDATE/DELETE via application.
  - Enforce at DB role or trigger level.
  - Backups and archival processes must preserve integrity and checksums.
- Authorization:
  - Enforce RBAC/ABAC in service layer; do not rely solely on gateway.
  - Audit queries restricted to tenant admins/auditors or internal system roles.
- Tamper-evidence:
  - Store checksums/HMAC for audit entries; rotate signing key via KMS and re-sign policy.
- Data retention & privacy:
  - Define tenant-based retention policy (e.g., 7 years) and archival procedures.
  - PII in metadata should be minimized and encrypted when stored.
- Operational:
  - Index hot query patterns (tenant + time, resource).
  - Implement pagination via cursor where possible.
  - Monitor table growth; plan partitioning by created_at/tenant_id.
- Testing:
  - Unit tests must mock Sequelize.
  - Integration tests must verify tenant isolation (attempted cross-tenant access must fail).
  - End-to-end tests should validate audit immutability and notification lifecycle.

## Notes
- Prefer async messaging for durability and decoupling.
- Ensure all internal endpoints use service authentication and are not public.
- Document retention, archival, and key rotation procedures in operations runbooks.