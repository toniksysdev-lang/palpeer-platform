# Palpeer Admin-End

Separate React admin operations frontend for the Palpeer platform.

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 3
- React Router 7
- TanStack Query 5
- Zod

## Phase status

| Phase | Status |
|-------|--------|
| 0 — Audit | Complete |
| 1 — Design system + shell | Complete (Gate 1) |
| 2 — Auth & route guards | Complete (Gate 2) |
| 3 — Dashboard (verified APIs) | Complete (Gate 3) |
| 4 — Users module | Complete (Gate 4) |
| 5 — KYC module | Complete (Gate 5) |
| 6 — Wallets module | Complete (Gate 6 — CONTRACT_PENDING live API) |
| 7 — Currencies + Rates | Complete (Gate 7) |
| 8 — Transactions module | Complete (Gate 8) |
| 9 — P2P module | Complete (Gate 9) |
| 10 — Negotiations + Chat | Complete (Gate 10 — CONTRACT_PENDING live) |
| 11 — Cards module | Complete (Gate 11 — CONTRACT_PENDING live) |
| 12 — Notifications + Promotions | Complete (Gate 12) |
| 13 — Reports + Audit | Complete (Gate 13) |
| 14 — Security + Hardening | Complete (Gate 14) |
| 15 — UX polish | Skipped (user advanced to Phase 16) |
| 16 — Testing | Complete (Gate 16) |
| 17 — Production build | Complete (Gate 17) |
| 18 — Definition of Done | Complete (Gate 18) |

## Quick start

```bash
cd palpeer-admin-end
cp .env.example .env.development
npm install
npm run dev
```

App: http://localhost:5173

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run typecheck` | TypeScript project references check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit + component + integration |
| `npm run test:e2e` | Playwright critical workflows (mock) |
| `npm run test:all` | Vitest + Playwright |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Environment

See `.env.example` / `.env.production.example`:

- `VITE_API_BASE_URL`
- `VITE_WS_URL`
- `VITE_APP_ENV`
- `VITE_USE_MOCK_API` — forced off in production builds

## Production verify

```bash
cd palpeer-admin-end
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

## Docs

- [Architecture](../docs/admin-architecture.md)
- [API map](../docs/admin-api-map.md)
- [UI map](../docs/admin-ui-map.md)
- [Permissions](../docs/admin-permissions.md)
- [Security](../docs/admin-security.md)
- [Definition of Done](../docs/admin-definition-of-done.md)
- [Contract pending](../docs/admin-contract-pending.md)
- [Decisions](../docs/admin-decisions.md)
- [Existing project audit](../docs/admin-existing-project-audit.md)
