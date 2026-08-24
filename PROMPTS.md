# PROMPTS.md — Copilot Prompt Chain

Documents the prompts used to build the Notification & Audit Service and SPEC.md,
in the order they were executed.

## Prompt Chain

### 1. Custom instructions setup
**Feature:** Ask Mode
**Technique:** Specificity + decomposition
**Prompt:** "Draft a .github/copilot-instructions.md for a multi-tenant B2B SaaS Node.js/Express project using Sequelize. Include sections for architecture, coding standards, security (multi-tenant isolation, auth), and testing expectations."
**Rationale:** Needed persistent, structured rules established before any code was written, split into clear categories so Copilot applies them consistently in every later prompt.

### 2. SPEC.md draft
**Feature:** Ask Mode
**Technique:** Constraint-based (explicit required headers)
**Prompt:** "Draft a technical specification (SPEC.md) for a Notification & Audit Service that integrates with an existing Project Service in a multi-tenant B2B SaaS app. It needs: an immutable AuditLog data model, a Notification data model, API contracts for creating audit entries and querying them, and constraints around immutability and multi-tenant authorization. Structure it with headers: Overview, Data Models, API Contracts, Integration Points, Constraints."
**Rationale:** Locked the shape of the spec before implementation began, so the build phase had a fixed contract to follow instead of improvising structure later.

### 3. Generate the unreviewed Project Service (verbatim, as instructed by the case study)
**Feature:** Agent Mode
**Technique:** Specificity (deliberately minimal — required verbatim by the assignment)
**Prompt:** "Generate a Project model and a Project service with create, update status, get by team, and delete functions. Use a database."
**Rationale:** Run exactly as-is to simulate inheriting unreviewed, low-effort contractor code, per the case study's explicit instruction not to modify this prompt.

### 4. Security review of the Project Service
**Feature:** Ask Mode + #file
**Technique:** Role-based
**Prompt:** "Act as a senior security engineer reviewing this Project service and model for a multi-tenant B2B SaaS application. List every issue you find across security, architecture, bugs, and standards. For each issue, state its severity and its impact if this service is depended on by other internal services." (with #file references to project.model.js and project.service.js)
**Rationale:** An expert framing surfaced security and architectural issues systematically, rather than a generic, unfocused code read-through.

### 5. Remediation refactor of the Project Service
**Feature:** Agent Mode + #file
**Technique:** Decomposition (six explicit, numbered sub-fixes in one prompt)
**Prompt:** "#file:project.model.js #file:project.service.js #file:copilot-instructions.md — Refactor this Project service into a proper layered architecture: model (unchanged) → repository (new file, all Sequelize calls) → service (business logic only, no direct model calls) → controller (new file, Express route handlers). Fix these specific issues while refactoring: 1. In createProject, verify the supplied teamId actually belongs to the supplied tenantId before creating the project — reject with a 403 if it doesn't. 2. Add input validation (using Zod) for name (non-empty, max 200 chars) and metadata (must be a plain object, max 10KB serialized) before creation. 3. Await the jobQueue.enqueue call in every function and throw/log if it fails — remove the logger-only fallback. 4. In getProjectsByTeam, exclude status 'deleted' by default unless the caller explicitly requests it, and clamp limit to a maximum of 100. 5. Wrap updateProjectStatus in the same transaction + row lock pattern already used in deleteProject. 6. Derive actorId and tenantId from an authenticated request context object passed into the controller, never trust them as raw parameters from the client. Keep all existing working logic (transactions, tenant scoping, soft-delete, audit hooks) intact."
**Rationale:** Consolidated every REVIEW.md finding into one coordinated multi-file refactor instead of fixing files one at a time.

### 6. Metadata size guard follow-up
**Feature:** Edit Mode
**Technique:** Iterative refinement
**Prompt:** "This function still allows metadata larger than 10KB. Add a size check using JSON.stringify(metadata).length before insert, and throw a 400 error if it exceeds 10240 bytes."
**Rationale:** Agent Mode's refactor missed this one constraint on the first pass; a follow-up, targeted prompt closed the gap without re-running the whole refactor.

### 7. Scaffold the Notification & Audit Service
**Feature:** Agent Mode + #file
**Technique:** Few-shot (exact field lists and route signatures supplied)
**Prompt:** "#file:SPEC.md #file:copilot-instructions.md #file:project.repository.js — Scaffold a Notification & Audit service under src/notifications/ following the same layered pattern as src/projects/ (model → repository → service → controller). Build exactly this: 1. AuditLog model — fields: id (UUID), eventType (enum: MILESTONE_CREATED, MILESTONE_UPDATED, MILESTONE_DELETED), entityType (string), entityId (UUID), actorUserId (UUID), actorOrganisationId (UUID), previousState (JSONB, nullable), newState (JSONB), timestamp (DateTime). No update or delete methods should exist on this model or its repository at all. 2. Notification model — fields: id (UUID), recipientUserId (UUID), eventType (string), projectId (UUID), message (string), readStatus (boolean, default false), createdAt (DateTime). 3. AuditService with: createAuditEntry(data), getAuditHistory(projectId, filters). 4. NotificationService with: createNotificationsForTeam(teamMemberIds, eventType, projectId, message), getUnreadForUser(userId), markAsRead(notificationId). 5. Controller with 4 routes: POST /audit, GET /audit/:projectId, GET /notifications/:userId, PATCH /notifications/:id/read. Enforce immutability at the service layer."
**Rationale:** Supplying the exact schema and route signatures from SPEC.md ensured generated code matched the spec instead of Copilot improvising field names or shapes.

### 8. Team-lookup design decision
**Feature:** Ask Mode
**Technique:** Role-based
**Prompt:** "As a backend architect, I need the Notification & Audit service to know which users are on a project's team when a milestone changes. Should the Project Service pass a list of teamMemberIds in its call to POST /audit, or should the Notification service call back into the Project Service to fetch the team? Give me the trade-offs."
**Rationale:** This needed a design decision, not generated code — Ask Mode was chosen specifically to get reasoning without triggering an unwanted file edit.

### 9. Explicit immutability guard
**Feature:** Edit Mode
**Technique:** Constraint-based
**Prompt:** "Add explicit updateAuditEntry and deleteAuditEntry methods that immediately throw an Error('Audit entries are immutable and cannot be modified or deleted') without touching the database. This is intentional — it's a safety guard, not dead code, so future developers can't accidentally add mutation methods without hitting an obvious wall."
**Rationale:** Turned an implicit design choice (simply omitting mutation methods) into an explicit, enforced guard that fails loudly if ever misused.

### 10. Missing notification repository
**Feature:** Agent Mode
**Technique:** Specificity
**Prompt:** "Create src/notifications/notification.repository.js following the same pattern as audit.repository.js. It needs: create(entry); findUnreadForUser({ tenantId, userId }) — returns notifications where tenant_id and recipient_user_id match and read_status is false, ordered by created_at DESC; markAsRead({ tenantId, notificationId }) — updates read_status to true, but only where tenant_id AND id match, and throws a 404-style error if no matching row was found."
**Rationale:** The initial scaffold (Prompt 7) referenced this file without generating it — this closed the gap with the same exact method signatures already in use.

### 11. Verify actor organisation matches tenant
**Feature:** Edit Mode
**Technique:** Constraint-based
**Prompt:** "In createAuditEntry, after parsing with auditSchema, verify that parsed.actor_organisation_id strictly equals tenantId. If they don't match, throw an error with status 403 and message 'actor organisation does not match authenticated tenant' before calling repository.create."
**Rationale:** Closed a security gap found during manual review — the schema validated shape but not that the value matched the authenticated caller.

### 12. Remove client-controlled timestamp
**Feature:** Edit Mode
**Technique:** Constraint-based
**Prompt:** "Remove the optional timestamp field from auditSchema entirely, and always set timestamp to new Date() server-side in createAuditEntry — never accept a client-supplied timestamp for an audit entry."
**Rationale:** An audit log's timestamp must be trustworthy; allowing a client-supplied value would let records be backdated.

### 13. Remove duplicate audit emission
**Feature:** Edit Mode
**Technique:** Constraint-based
**Prompt:** "Remove the block in createNotificationsForTeam that calls auditService.createAuditEntry directly — the audit entry for a milestone change should only be written once, by the Project Service calling POST /audit, not duplicated here. createNotificationsForTeam should only create notification rows, nothing else."
**Rationale:** The generated code produced two separate, differently-shaped audit trails for the same event — this enforced a single source of truth per SPEC.md.

### 14. Authorization on notification access
**Feature:** Edit Mode
**Technique:** Constraint-based
**Prompt:** "In the GET /notifications/:userId route, add a check that req.context.userId (the authenticated caller) matches the requested :userId param. If they don't match, respond with 403 Forbidden before calling the service."
**Rationale:** Closed a gap that would have let any authenticated user in a tenant view any other user's notifications.

### 15. Generate the test suite
**Feature:** Agent Mode + #file
**Technique:** Specificity + few-shot (6 exact numbered cases)
**Prompt:** "#file:audit.service.js #file:notification.service.js #file:audit.repository.js #file:notification.repository.js — Generate a Jest test file at tests/notification-audit.test.js covering these 6 cases, using in-memory mocked repositories (no real database): [6 cases listed]. Mock the repository layer so tests don't require a real database connection."
**Rationale:** Naming all 6 required cases explicitly ensured full coverage instead of leaving case selection to Copilot's judgment.

### 16. Fix invalid UUID test fixtures
**Feature:** Edit Mode
**Technique:** Iterative refinement
**Prompt:** "Replace all placeholder ID strings like 'proj-1', 'org-1', 'org-2', 'user-1', and the team member IDs with valid v4-format UUID strings (e.g. 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' style), keeping each unique ID consistent everywhere it's reused across the file so the same logical entity always has the same UUID."
**Rationale:** A test run failure (Zod UUID validation errors) revealed the generated fixtures used non-UUID placeholders; this fixed the actual bug found by running the suite.

### 17. Impact analysis for scope change
**Feature:** Ask Mode + #file
**Technique:** Decomposition (affected files, change nature, security risk, and sequencing requested separately)
**Prompt:** "#file:audit.model.js #file:audit.service.js #file:notification.service.js #file:SPEC.md — The product team has issued this change request: 'Add a new milestone event type: MILESTONE_REOPENED. This should trigger audit logging and notifications. Audit entries must now also capture the actor's IP address.' Analyze the impact of this change: which files, models, and modules are affected, whether each change is additive, breaking, or requires a migration, and what security/compliance risks arise from storing IP addresses. Give me a draft I can refine."
**Rationale:** Structured the request into distinct technical, security, and sequencing angles before any code was touched, matching the "before touching any code" instruction in the brief.

## Post-Generation Corrections

Every change made to Copilot's output, what was wrong, and how it was fixed:

1. **Missing tenant/team boundary check (Project Service).** The generated createProject left a comment stating boundary validation "should be done by caller" — no such check existed anywhere. Fixed via Prompt 5 by adding a server-side lookup that verifies the team belongs to the caller's tenant.
2. **Unreliable audit emission (Project Service).** The original code called jobQueue.enqueue without awaiting it, and silently fell back to a plain log line if no queue was configured — meaning audit records could vanish silently. Fixed via Prompt 5 by awaiting the call and removing the logger-only fallback.
3. **Soft-deleted projects not excluded by default.** getProjectsByTeam returned deleted records unless the caller explicitly filtered them out. Fixed via Prompt 5.
4. **Unbounded metadata size.** The first refactor pass didn't enforce the 10KB metadata limit despite being asked. Fixed via a targeted follow-up (Prompt 6).
5. **Missing notification.repository.js.** The initial scaffold (Prompt 7) referenced repository methods in notification.service.js without generating the file itself — this would have failed at runtime. Detected by tracing the imports; fixed via Prompt 10.
6. **Unverified actor_organisation_id.** audit.service.js validated the shape of actor_organisation_id but never checked it matched the authenticated tenantId, allowing a caller to forge audit records under another organisation's name. Fixed via Prompt 11.
7. **Client-controlled audit timestamp.** The original schema allowed a caller-supplied timestamp field, which could let audit records be backdated. Fixed via Prompt 12.
8. **Duplicate audit entries.** notification.service.js independently wrote its own audit entry for each notification batch, in addition to the one written via POST /audit — creating two inconsistent audit trails for the same event. Fixed via Prompt 13.
9. **No authorization check on GET /notifications/:userId.** Any authenticated user in a tenant could view any other user's notifications simply by supplying their user ID in the URL. Fixed via Prompt 14.
10. **Invalid UUID test fixtures.** The generated test file used human-readable placeholder IDs (e.g. 'proj-1', 'org-1') that failed the services' own Zod UUID validation, causing 2 of 6 tests to fail on first run. Detected via the Jest error output; fixed via Prompt 16 by replacing all fixtures with consistent, valid v4-format UUIDs.