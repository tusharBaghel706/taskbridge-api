# Impact Analysis — MILESTONE_REOPENED + Actor IP Address Capture

## Change Request
"Add a new milestone event type: MILESTONE_REOPENED. This should trigger audit logging
and notifications. Audit entries must now also capture the actor's IP address."

## Affected Files, Modules, and Data Models

| File/Module | Nature of change | Details |
|---|---|---|
| audit.model.js | Breaking (schema) / Migration required | event_type is a Postgres ENUM (MILESTONE_CREATED, MILESTONE_UPDATED, MILESTONE_DELETED). Adding MILESTONE_REOPENED requires an ALTER TYPE migration, not just a code change. |
| audit.model.js | Additive / Migration required | New column actor_ip_address (string, nullable for backward compatibility with historical rows) must be added via migration. |
| audit.service.js — createAuditEntry | Additive | auditSchema (Zod) must accept the new enum value and a new actor_ip_address field; validate it's a well-formed IPv4/IPv6 string. |
| notification.service.js | Additive | No schema change needed — eventType is a plain string here, not an enum, so MILESTONE_REOPENED passes through without modification. |
| Project Service (src/projects/) | Additive | Wherever milestone state transitions are triggered, a "reopen" action/status transition must be added, and its handler must call POST /audit with event_type: 'MILESTONE_REOPENED' and the caller's IP. |
| audit.controller.js (POST /audit) | Additive | Must extract the caller's IP from the request (e.g. req.ip or a trusted X-Forwarded-For header behind a proxy) and pass it through to the service layer — this should NOT be a client-supplied field, for the same trust-boundary reason actor_organisation_id is server-verified. |
| SPEC.md | Additive | Update data model and API contract sections to document the new field and event type. |
| tests/ | Additive | New test cases needed: audit entry created correctly for MILESTONE_REOPENED; actor_ip_address is captured and persisted; IP is never trusted from client input. |

## Security & Compliance Risks of Capturing IP Addresses

- **Privacy classification**: IP addresses are considered personal data under GDPR and similar regimes — this expands what's stored as PII inside the audit log, which was previously lower-risk operational data.
- **Data retention**: audit logs are immutable and (by design) never deleted — this means IP addresses would be retained indefinitely unless a separate retention/anonymisation policy is added specifically for this field. That likely needs a legal/compliance sign-off, not just an engineering decision.
- **Logging exposure**: if actor_ip_address is ever echoed into application logs, error messages, or third-party monitoring tools (e.g. exception trackers), it multiplies the number of places PII now lives, which was not true before this change.
- **IP spoofing risk**: if extracted from a client-supplied header (X-Forwarded-For) without validating it's coming from a trusted proxy, this field could be forged, undermining its evidentiary value for compliance/audit purposes.

## Recommended Implementation Approach & Sequencing

1. Write and test the database migration first (ALTER TYPE to add the enum value + ADD COLUMN actor_ip_address), in isolation, before any service code changes.
2. Update audit.service.js's Zod schema to accept the new enum value and the new field, with IP extracted server-side in the controller — never trusted from the request body.
3. Update the Project Service's milestone-reopen code path to call POST /audit with the new event type.
4. Add the new test cases.
5. Update SPEC.md to reflect the new field and event type.
6. Flag the retention question to whoever owns compliance/legal before this ships to production — this is a policy decision, not just a technical one.

## How Copilot Assisted This Analysis

I prompted Copilot (Ask Mode, with #file references to audit.model.js, audit.service.js,
and SPEC.md) to draft an initial impact analysis. It correctly identified that event_type
is likely an enum requiring a migration and listed the obvious file-level changes. However,
it did not initially flag [pick what's true for you, e.g.: "the data-retention policy
implication of storing PII inside an append-only, undeletable audit log" OR "that the IP
address must be extracted server-side rather than accepted from the client, the same trust
boundary issue we fixed for actor_organisation_id earlier"] — I added that section myself,
since it requires understanding this specific service's immutability design and its
existing security posture, not just generic knowledge of what change request analysis
usually covers.