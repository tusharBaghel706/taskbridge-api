# TOOL_STRATEGY.md

## Feature Usage Log

Minimum 6 entries, covering at least 4 different Copilot features used across this case study.

| # | Where used | Feature | Why this feature (not another) | What happened |
|---|---|---|---|---|
| 1 | Setting up .github/copilot-instructions.md | Ask Mode | No file changes needed yet — just wanted a draft to review and edit myself before it became a persistent, repo-wide rule set | Produced a reasonable first draft with architecture/security/testing sections; I edited the security section to add the specific multi-tenant isolation rule before finalizing |
| 2 | Generating the baseline Project Service | Agent Mode | Needed Copilot to actually create files in src/projects/, not just describe code in chat | Generated project.model.js and project.service.js directly into the folder, saved as-is per the case study's instruction |
| 3 | Reviewing the Project Service for security/architecture issues | Ask Mode + #file | Wanted a structured, reasoned review, not a file edit — #file gave it direct access to both files without me pasting code manually | Surfaced several real issues (input validation gaps, missing layering) but missed the tenant/team boundary comment and the audit-emission reliability issue, both of which I caught manually |
| 4 | Checking the Project Service against copilot-instructions.md | @workspace | Needed Copilot to reason about the file in the context of the whole repo's stated conventions, not just the file in isolation | Confirmed the missing repository/controller layers, which fed directly into the refactor prompt |
| 5 | Investigating whether actorId could be trusted | Inline Chat (Ctrl+I) | Wanted a fast, scoped answer about one specific line without opening the full chat panel or providing broader context | Confirmed the trust-boundary concern was valid, which led to deriving actorId from the authenticated request context instead of a raw parameter |
| 6 | Refactoring the Project Service into layers with 6 named fixes | Agent Mode + #file | Needed a coordinated multi-file change (new repository and controller files, edits to model/service) applied consistently in one pass | Produced the layered structure and most fixes correctly; the metadata size limit was missed on the first pass and needed a follow-up Edit Mode prompt |
| 7 | Scaffolding the Notification & Audit Service | Agent Mode + #file | Needed multiple new files created at once (2 models, 2 services, 1 controller) following an existing pattern | Generated a working first pass but omitted notification.repository.js entirely, which surfaced later as a missing-module error |
| 8 | Fixing the notification service, audit service, and controller post-generation | Edit Mode | Each fix was a small, targeted change to an existing file with a diff I wanted to review before accepting | All 6 fixes (tenant check, timestamp, duplicate audit removal, transaction wrap, authorization check, missing repository) applied cleanly with reviewable diffs |
| 9 | Generating the test suite | Agent Mode + #file | Needed a full new test file referencing 4 existing source files, with 6 explicitly named cases | Generated a structurally correct test file; 2 of 6 tests initially failed due to invalid UUID placeholder fixtures, fixed via a follow-up Edit Mode prompt |
| 10 | Drafting the impact analysis for the scope change | Ask Mode + #file | Wanted a reasoned draft to correct and extend, not a generated file — this section requires human judgment on compliance risk, not just code | Correctly identified the migration/enum implications, but I added the data-retention and IP-spoofing risk points myself |

## Scenario Responses

**1. Understanding a complex 600-line legacy service in an unfamiliar codebase before wiring a new service to it.**
I'd use **Ask Mode with `@workspace`/`/explain`**. This is a pure comprehension task — no code should change yet — and `@workspace` lets Copilot reason about how the file fits into the rest of the repo's conventions rather than reading it in isolation. `/explain` on specific confusing blocks lets me drill in incrementally instead of asking for one giant summary that might gloss over important details.

**2. Generating consistent, standards-compliant request-validation middleware across 10 existing route handlers.**
I'd use **Agent Mode**. This needs the same pattern applied consistently across many files at once — doing it one handler at a time in Edit Mode risks drift between them, whereas Agent Mode can apply one consistent validation approach across all 10 in a single coordinated pass, which I'd then spot-check rather than fully re-review each file.

**3. Quickly verifying whether a JWT verification implementation correctly handles token expiry and signature tampering.**
I'd use **Ask Mode for a reasoned review, plus `/tests` to generate targeted test cases** (expired token, tampered signature, valid token). This isn't something I'd trust a generated implementation to self-certify — I want Copilot to help me write test cases that would actually fail if the implementation were wrong, then run them myself.

**4. Enforcing that all commits to main pass linting and test coverage thresholds automatically, with no human intervention.**
This isn't really a Copilot-in-the-IDE feature at all — it's a **CI/CD pipeline concern** (e.g. GitHub Actions with branch protection rules and required status checks). Copilot can help me *write* the workflow YAML faster, but the actual enforcement has to live outside the editor, in the repository's branch protection settings.

**5. Reviewing a contractor's AI-generated service module for security vulnerabilities before it reaches staging.**
I'd use **Ask Mode with a role-based prompt** ("review as a security engineer"), the same approach I used on the Project Service in this case study — combined with my own manual read-through. I wouldn't rely on the AI review alone; in my own experience this case study, the AI review missed a real tenant-isolation gap that I only caught by reading the code myself.

**6. Ensuring Copilot follows multi-tenant data isolation rules consistently across all developers and sessions.**
I'd rely on **`.github/copilot-instructions.md`**. It's the one mechanism that persists across every developer's session automatically, rather than depending on each person remembering to ask for tenant scoping in every prompt. It's not a guarantee (as I found in this case study — it didn't stop every gap), but it's the best available lever for consistency at the team level.

## Limitations Encountered

**1. Missing dependency file (notification.repository.js) after scaffolding.**
*Prompted:* Agent Mode to scaffold the full Notification & Audit Service, including AuditService and NotificationService.
*What went wrong:* NotificationService's code referenced `repository.create`, `repository.findUnreadForUser`, and `repository.markAsRead`, but Copilot never generated the actual `notification.repository.js` file — only `audit.repository.js` was created.
*How I detected it:* The app would have failed at runtime (`Cannot find module`) — I caught it by tracing the imports in `notification.service.js` before running anything, then confirmed it when I later tried to run the tests and got a similar module error for an unrelated missing package.
*How I fixed it:* A follow-up Agent Mode prompt explicitly asking for `notification.repository.js` with the exact method signatures already referenced in the service file.
*What I'd do differently:* Explicitly list every file I expect to be created in the initial scaffold prompt, rather than assuming a "follow the same pattern" instruction guarantees full parity between the two services.

**2. Invalid UUID test fixtures causing false test failures.**
*Prompted:* Agent Mode to generate a Jest test file covering all 6 required test cases with mocked repositories.
*What went wrong:* Copilot used human-readable placeholder strings ('proj-1', 'org-1', 'user-1') as ID values, which are not valid UUIDs — 2 of 6 tests failed with ZodError validation failures when run, because the service layer's own schema correctly rejects non-UUID strings.
*How I detected it:* Ran the test suite (`npx jest`) and read the Zod error output, which pointed directly at the offending fields.
*How I fixed it:* A follow-up Edit Mode prompt asking Copilot to replace all placeholder IDs with consistent, valid v4-format UUID strings across the file.
*What I'd do differently:* When asking Copilot to generate tests against services with strict input validation, explicitly state the ID format requirement (e.g. "use valid v4 UUID strings") in the original prompt instead of discovering it via a failed test run.

**3. Security review missed a disclosed-but-unenforced gap.**
*Prompted:* Ask Mode, role-based ("act as a senior security engineer"), reviewing the Project Service for security and architecture issues.
*What went wrong:* The review correctly flagged several issues but did not flag that `createProject` contained a comment explicitly stating tenant/team boundary validation "should be done by caller" — meaning no such validation existed anywhere in the actual call chain, a critical multi-tenant security gap.
*How I detected it:* Manual, line-by-line reading of the function after the AI review, specifically looking for gaps between what the code claimed to do (via comments) and what it actually enforced.
*How I fixed it:* Added an explicit server-side check verifying the team's tenant_id matches the caller's tenantId before allowing project creation, as part of the layered refactor.
*What I'd do differently:* Treat any comment that defers responsibility ("caller should," "assumes," "TODO") as a manual-review flag by default, since these are exactly the spots where an AI review is least likely to notice the gap — the code isn't syntactically wrong, it's just silently trusting something it shouldn't.