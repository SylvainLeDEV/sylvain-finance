# SY Finance – Project Plan

## Vision
SY Finance is a self-hosted personal finance dashboard inspired by Finary. It provides
a consolidated view of accounts, investments, transactions, and savings goals, with
visualizations and analytics for personal budgeting and wealth tracking.

## High-Level Architecture
- **Frontend**: React (Vite, TypeScript) SPA served by Nginx in production, with Vite dev server in development.
- **Backend**: Node.js (Express + TypeScript) REST API, structured with modular routing and Zod validation.
- **Database**: PostgreSQL 16 storing accounts, valuations, transactions, budget categories, and goals.
- **Infrastructure**: Dockerized services orchestrated with docker-compose for both development and production.

## Feature Breakdown
1. **Authentication (future-ready)**
   - Placeholder structure to add auth routes and middleware later.
2. **Accounts Management**
   - CRUD endpoints and UI for financial accounts with type, currency, and metadata.
3. **Historical Values**
   - Record daily/periodic values per account plus net flows to compute performance.
4. **Transactions & Budgeting**
   - Track income/expenses with categories; compute monthly budgets.
5. **Goals Tracking**
   - Focus on real-estate savings goal, with progress tracking and projections.
6. **Analytics & Visualizations**
   - Dashboard charts using Recharts for net worth trend, allocation, and budget usage.

## Development Workflow
- Use `docker compose up --build` for integrated dev environment with hot reload.
- Frontend runs via Vite dev server mapped through docker-compose.
- Backend uses nodemon for auto-restart on changes.
- Database persists data via named volume.

## Production Workflow
- Build optimized frontend assets served by Nginx.
- Backend compiled to JavaScript before runtime, running with Node 22 Alpine image.
- Compose file `docker-compose.prod.yml` builds images and runs them in detached mode.
- Environment variables managed via `.env` files (not committed) for secrets and configuration.

## Milestones
1. **Scaffolding (current)**
   - Generate project skeleton with Docker, tooling, and sample routes/pages.
2. **Data Layer Implementation**
   - Wire up repositories, migrations, and actual DB queries.
3. **UI Enhancements**
   - Implement charts, forms, state management.
4. **Authentication & Security Hardening**
   - Optional: add JWT-based auth, HTTPS termination, monitoring.

## Testing Strategy
- Unit tests via Vitest (frontend) and Jest or Vitest (backend) in future iterations.
- Integration tests hitting API endpoints once repositories implemented.
- End-to-end tests optional with Playwright.

## Deployment Considerations
- Reverse proxy (e.g., Caddy/Traefik) can front the stack in production.
- Automatic backups for PostgreSQL volume recommended.
- Monitor resource usage and schedule periodic container restarts if needed.

