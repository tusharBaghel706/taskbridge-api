# TaskBridge API

Notification & Audit Service + remediated Project Service for the TaskBridge platform.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **ORM:** Sequelize
- **Database:** SQLite (dev) / PostgreSQL-compatible schema (production)
- **Validation:** Zod
- **Testing:** Jest

## Project Structure
taskbridge-api/
├── .github/
│ └── copilot-instructions.md
├── src/
│ ├── projects/ # Remediated Project Service (model/repository/service/controller)
│ └── notifications/ # Notification & Audit Service (model/repository/service/controller)
├── tests/
├── SPEC.md
├── REVIEW.md
├── IMPACT_ANALYSIS.md
├── PROMPTS.md
├── PR_DESCRIPTION.md
├── TOOL_STRATEGY.md
├── ARCHITECTURE.md
└── README.md


## Setup

```bash
npm install
```

## Running Tests

```bash
npx jest tests/notification-audit.test.js
```

## Documentation

See `ARCHITECTURE.md` for the service design overview, `SPEC.md` for the Notification &
Audit Service technical specification, and `REVIEW.md` for the Project Service code review.