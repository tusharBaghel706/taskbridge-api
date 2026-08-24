# ARCHITECTURE.md

The Project Service and the Notification & Audit Service are two independent, layered
services connected by a single integration contract: whenever the Project Service creates,
updates, or deletes a project milestone, it calls `POST /audit` on the Notification & Audit
Service with the event type, entity details, actor context, a before/after state snapshot,
and the list of team member IDs to notify. The Notification & Audit Service does not call
back into the Project Service — team membership is passed in on each request — which avoids
a circular dependency between the two services at the cost of trusting the Project Service
to supply an accurate team list.

Both services follow the same layered pattern: model → repository → service →
controller/route. An inbound API request hits the controller, which extracts the
authenticated caller's tenant/user context, passes it to the service layer for business
logic and validation, which calls the repository for all database access — the model itself
never talks directly to a route handler. For a milestone change, this means the flow runs
from the Project Service's controller, through its service layer (which enforces the
tenant/team boundary check), to its repository, and then out via an HTTP call into the
Notification & Audit Service's own controller → service → repository chain, where the audit
service enforces immutability (no update/delete path exists at all) before the notification
service creates one record per team member inside a single transaction.

This layered, service-per-concern architecture suits a multi-tenant B2B SaaS product
because it keeps tenant-isolation logic enforced consistently at the service layer in both
services, rather than scattered across ad-hoc query filters, and it lets the audit trail
remain the single source of truth for compliance even as more services are added later,
since any new service can write to it the same way the Project Service does.

Key trade-offs: passing `teamMemberIds` inline avoids a circular service dependency but
means the Notification service can't independently verify team membership is current; and
the audit write and notification creation are not wrapped in one distributed transaction,
so a crash between the two could leave an audit entry with no corresponding notifications —
acceptable for this sprint's timeline, but worth revisiting with a retry/outbox pattern
before this goes to production.