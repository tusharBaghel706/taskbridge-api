# PR: Notification & Audit Service + Project Service Remediation

## Summary

This PR delivers two pieces of work for the upcoming sprint. First, it reviews and
remediates the inherited Project Service (originally generated from a single low-effort
prompt, committed unreviewed) — fixing 8 identified issues spanning multi-tenant security,
input validation, and architecture, and restructuring it into a proper layered
model/repository/service/controller design. Second, it builds a new Notification & Audit
Service on top of the remediated Project Service, providing immutable audit logging of all
project milestone changes and notification dispatch to relevant team members, exposed via 4
REST endpoints. Both services follow a shared set of custom Copilot instructions
(.github/copilot-instructions.md) to keep architecture, security, and testing conventions
consistent across the codebase.

## AI Tool Disclosure

**Copilot features used:** Ask Mode, Agent Mode, Edit Mode, Inline Chat, `#file` context
references, `@workspace` queries, and the custom `.github/copilot-instructions.md` file.

**Mode usage breakdown:**
- **Ask Mode** — used for design discussions and reviews where I didn't want direct file
  edits (security review of the Project Service, the team-lookup design decision, the
  scope-change impact analysis).
- **Agent Mode** — used for multi-file scaffolding (the Project Service layered refactor,
  the initial Notification & Audit Service scaffold, the test file generation, the missing
  repository file).
- **Edit Mode** — used for every targeted, single-issue fix after manual review (the
  actor_organisation_id check, removing the client-controlled timestamp, removing the
  duplicate audit emission, the notification authorization check, the UUID test-fixture
  fix).
- **Inline Chat** — used once, to ask a scoped question about trusting `actorId` directly
  in context.

**Accepted vs overridden:** I accepted Copilot's output as a starting point in every case,
but overrode or extended it in every file — most significantly: the initial Project Service
had no repository/controller layer and left tenant/team boundary validation unenforced
(overrode); the initial Notification & Audit scaffold omitted the notification repository
entirely and independently duplicated audit-writing logic that conflicted with the
single-source-of-truth design in SPEC.md (overrode); the generated test file used non-UUID
placeholder fixtures that failed the services' own validation (overrode).

**Estimated AI-generated vs hand-written:** roughly 65% AI-generated as a starting
scaffold, 35% hand-directed correction and refinement — the initial structure, boilerplate,
and first-pass logic came from Copilot prompts, but nearly every file required at least one
manual-judgment fix (security, business-rule, or architectural) that Copilot did not
surface on its own.

**Did copilot-instructions.md help?** Partially. It kept naming conventions and the
model→repository→service→controller layering consistent across both services once
established, but it did not prevent Copilot from missing several security-specific issues
(e.g. the tenant/team boundary gap, the unverified actor_organisation_id) — those still
required manual review to catch, suggesting the instructions file is good for structural/
stylistic consistency but isn't a substitute for a real security review pass.

## Integration Between Services

The Project Service is the source of truth for project and milestone state. When a
milestone is created, updated, or deleted, the Project Service calls `POST /audit` on the
Notification & Audit Service with the event type, entity details, actor context, and a
before/after state snapshot. The Notification & Audit Service is responsible for writing
that as an immutable audit record and generating notification records for the project's
team members. Team membership is passed in in the request payload (`teamMemberIds`) rather
than the Notification service calling back into the Project Service — this avoids a
circular dependency between the two services and keeps the Notification service simpler,
at the cost of trusting the Project Service to supply an accurate team list.

## Testing Coverage & Known Gaps

**Coverage:** 6 test cases covering notification dispatch to all team members, audit entry
creation correctness, immutability enforcement (update/delete always throw), date-range
filtering, event-type filtering, and cross-tenant isolation on audit history queries. All
6 pass against mocked repositories (no live database).

**Known gaps:**
- No integration tests against a real database — all tests use mocked repositories, so
  actual Sequelize query behavior (index usage, real transaction behavior under load) is
  untested.
- No test coverage yet for the Project Service's remediated code specifically (tests were
  written for the new Notification & Audit Service only).
- `markAsRead` in `notification.repository.js` doesn't verify the update actually affected
  a row before returning success — a request for a nonexistent or cross-tenant notification
  ID currently returns 204 instead of 404.

## Risk / Trade-off

The audit write (via `POST /audit`, called by the Project Service) and the notification
batch creation (in the Notification service) are two separate operations, not wrapped in a
single distributed transaction. If the Notification service crashes after successfully
writing the audit entry but before creating notifications, the audit trail will show a
milestone change occurred with no corresponding notifications ever sent — a partial-failure
state that would need to be reconciled manually or via a retry/outbox mechanism in a real
production system. I accepted this trade-off for now given the sprint timeline, but it's a
gap worth flagging before this goes to production.

## Self-Review Checklist

- [x] No hardcoded secrets or credentials in any file
- [x] All external inputs (request bodies, query params) validated with Zod before use
- [x] Errors caught and returned as specific, sanitized responses — no raw DB errors
      leaked to the client
- [x] All Project and Notification/Audit queries are scoped by tenantId/organisationId
- [x] Code follows the layered architecture and naming conventions defined in
      copilot-instructions.md
- [x] All AI-generated suggestions were read and reasoned about before acceptance, not
      accepted blindly
- [x] Tests cover happy path, immutability/error path, and cross-tenant isolation
- [ ] Integration/database-level tests — not yet done (noted as a known gap above)

## Peer Review Simulation

Written as if reviewing a teammate's version of this feature:

1. **`audit.service.js`, `createAuditEntry`** — "This checks that `actor_organisation_id`
   matches the authenticated `tenantId`, which is good, but the check happens *after*
   `auditSchema.parse(data)` runs. If schema parsing itself becomes more permissive later
   (e.g. someone loosens a field), we'd want the tenant check to be the very first thing
   that runs, not dependent on validation order. Consider moving the tenant check to the
   top of the function, before any parsing, so it's the first gate regardless of future
   schema changes."

2. **`notification.repository.js`, `markAsRead`** — "`Notification.update()` returns an
   affected-row count, but this function doesn't check it before resolving successfully.
   A request with a nonexistent or cross-tenant `notificationId` currently returns 204 as
   if it succeeded. Please check the returned count and throw a 404 if it's zero — this
   is the kind of thing that's easy to miss because the happy path 'just works' in
   testing, but a copy-pasted bad ID from a client would fail silently in production."

3. **`notification.service.js`, `createNotificationsForTeam`** — "This is something AI
   tooling wouldn't flag on its own: if `teamMemberIds` is empty (e.g. a project with no
   assigned team yet), this function will just return an empty array with no warning or
   log line. That might be completely fine, but it's a silent no-op for what could be a
   meaningful business event (a milestone changed and *nobody* got notified). Worth
   adding at least a debug log when the team list is empty, so this isn't invisible if it
   turns out to be a real data problem later."