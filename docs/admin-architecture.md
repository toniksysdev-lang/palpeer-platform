# Admin architecture (Phase 1)

## Application location

`palpeer-admin-end/` — separate Vite SPA; does not share runtime with Spring modules.

## Runtime stack

- React 19 + TypeScript (strict)
- Vite 6
- Tailwind CSS with semantic design tokens
- React Router (`/admin/*`)
- TanStack Query (wired; unused for live data until Phase 2+)
- Zod for env validation

## Source layout

```text
src/
  app/          providers, router
  components/   ui, navigation, feedback
  config/       env, navigation
  features/     domain feature modules (dashboard first)
  layouts/      AdminLayout shell
  pages/        thin route placeholders
  lib/          cn, theme helpers
```

## Shell

- Left sidebar (expanded / collapsed / mobile drawer)
- Sticky header with breadcrumbs, search stub, theme cycle, env badge
- Mock-mode banner when `VITE_USE_MOCK_API=true`
- Toast viewport

## Auth

Phase 2 implemented:

- `/sign-in` with validation, show/hide password, remember session, error mapping
- Token persistence (`sessionStorage` / optional `localStorage`)
- Refresh-on-401 / proactive expiry refresh
- `RequireAuth` route guard for `/admin/**`
- Admin role probe via `GET /admin/users`
- Logout with refresh-token revoke

## Dashboard (Phase 3)

Verified sources:

| Widget | Source |
|--------|--------|
| Total users | `GET /admin/users` → `totalElements` |
| KYC cases | `GET /admin/kyc/cases` → `totalElements` |
| P2P requests/orders | `GET /admin/p2p/requests|orders` → list length |
| Recent users / KYC | first page `content` |
| Audit feed | `GET /admin/audit-logs` |
| Currencies | `GET /currencies` |

Unavailable (CONTRACT_PENDING): transaction volume, pending KYC filtered queue, wallet balances, fees/revenue, alert charts.

## Data rules

- No fabricated operational metrics
- CONTRACT_PENDING modules render explicit unavailable states
- Production builds force mock mode off
