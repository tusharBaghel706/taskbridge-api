Purpose
- Provide clear guidance to GitHub Copilot and contributors for a multi-tenant B2B SaaS Node.js + Express project using Sequelize.
- Keep suggestions secure, testable, and aligned with repository conventions.

Architecture
- API: Express with layered structure: routes -> controllers -> services -> repositories (Sequelize models).
- DB multi-tenancy patterns (prefer one; implement consistently):
  - Schema-per-tenant (recommended for strong isolation) or
  - Shared-schema with tenant_id + strict row-level scoping.
- Use a tenant-scoped context object available in request lifecycle (middleware populates req.tenant or request-scoped DI).
- Prefer small, single-responsibility modules. Keep controllers thin; business logic in services.
- Reference files and directories:
  - [package.json](package.json)
  - [README.md](README.md)
  - [prompts.md](prompts.md)
  - [.github/copilot-instructions.md](.github/copilot-instructions.md)
  - [src/notifications/](src/notifications/)
  - [src/projects/](src/projects/)
  - [tests/](tests/)

Coding standards
- Style: follow ESLint + Prettier rules (apply project config). Use consistent import style and naming.
- Async: use async/await, avoid mixing callbacks and promises.
- Patterns:
  - controllers: validate input, call services, return normalized responses.
  - services: orchestrate business logic, no Express req/res usage here.
  - repositories/models: only DB interaction using Sequelize ORM methods, parameterized queries.
- Error handling: throw typed errors, map to HTTP responses in an error-handling middleware.
- Logging: structured logging (e.g., pino/winston). No console.log in production code.
- Types & docs: add JSDoc or TypeScript types where available. Small functions and clear argument names.

Security (multi-tenant isolation, auth)
- Multi-tenant isolation:
  - Never trust client-provided tenant identifiers. Derive tenant from authenticated token, subdomain, or signed session.
  - For shared-schema: add mandatory tenant_id filter on all queries; implement repository helper that automatically adds tenant scope.
  - For schema-per-tenant: ensure connection/transaction is bound to tenant schema and migrations run per-tenant.
  - Block cross-tenant access in unit of work; add tests asserting tenant boundaries.
- Auth & access control:
  - Use JWT access tokens + refresh tokens or OAuth2 as appropriate. Short-lived access tokens; securely store refresh tokens.
  - Enforce RBAC/ABAC checks in services (not only in controllers).
  - Hash credentials with bcrypt/argon2; enforce strong password policies and MFA for admin roles.
  - Store secrets in environment variables and secrets manager; never commit secrets.
- Data protection:
  - Use parameterized Sequelize queries; avoid raw SQL unless sanitized.
  - Encrypt sensitive fields at rest where needed.
  - Use HTTPS, secure cookies (HttpOnly, Secure, SameSite), helmet, rate-limiting, and input validation/sanitization (Joi/celebrate or zod).
- Audit & monitoring:
  - Record admin actions and cross-tenant administrative events with tenant context.
  - Emit security-relevant logs to central system.
- CI security checks:
  - Run dependency scanning & linting in CI. Fail on critical vulnerabilities.

Testing expectations
- Unit tests:
  - Cover services, utilities, and repository helpers. Mock Sequelize model calls.
  - Fast, deterministic, and isolated.
- Integration tests:
  - Exercise route -> controller -> service -> DB. Use a test DB instance (in-memory or ephemeral container). Use transactions and rollback between tests or recreate schema.
  - Include tests that assert tenant isolation: same-request tenant cannot access another tenant's data.
- E2E tests:
  - Basic happy-path and major flows. Run in CI against staging-like environment.
- Test quality gates:
  - Maintain a minimum coverage threshold (e.g., 80% or project policy).
  - All PRs must pass lint, unit, and integration tests.
- Test tooling:
  - Use Jest/Mocha as project default. Place tests under [tests/](tests/) and keep naming consistent.
  - CI runs: lint -> unit -> integration -> build.
- Fixtures & seeds:
  - Provide deterministic test fixtures; avoid relying on external services. Use factories and fixtures stored under [tests/](tests/).

How Copilot should behave
- Propose code that adheres to the architecture and coding standards above.
- Prefer safe defaults: validated inputs, parameterized DB calls, scoped tenant context.
- When suggesting DB queries, include tenant scoping by default.
- Favor small, testable functions and add unit tests for new logic.
- Avoid suggesting secrets, hard-coded credentials, or insecure defaults.

When unsure
- If tenant behavior is ambiguous, default to denying access or ask reviewer to confirm (fail-closed).
- If a suggestion would change the tenancy model (schema-per-tenant vs shared), ensure a migration plan and CI tests are included.

Repository links (for quick navigation)
- [package.json](package.json)
- [prompts.md](prompts.md)
- [README.md](README.md)
- [.github/copilot-instructions.md](.github/copilot-instructions.md)
- [src/notifications/](src/notifications/)
- [src/projects/](src/projects/)
- [tests/](tests/)