# Admin permissions (frontend)

Backend is authoritative. Frontend `can()` helpers arrive with Phase 2 session decoding.

## Seeded backend codes (VERIFIED)

| Code | Intended UI |
|------|-------------|
| `users:read` | Users list/detail |
| `users:write` | User status updates |
| `kyc:read` | KYC queue |
| `kyc:review` | KYC review actions |
| `rates:write` | Publish rates |
| `currencies:write` | Create currencies |
| `transactions:read` | Per-user transactions |
| `p2p:read` | P2P lists |
| `p2p:write` | P2P status updates |
| `promotions:write` | Promotions mutations |
| `admin:manage` | Admin RBAC screens |
| `audit:read` | Audit logs |
| `wallets:read` | Wallet inventory / ledger |
| `cards:read` | Card inventory / card txs |
| `cards:write` | Card block / unblock |
| `negotiations:read` | Negotiation inventory |
| `chat:read` | Chat rooms / messages |
| `notifications:read` | Notification inventory |
| `ROLE_ADMIN` | Access to `/admin/**` |

## Phase 2 behavior

- Unauthenticated users are redirected from `/admin/**` to `/sign-in`.
- After login, admin access is verified via `GET /admin/users?page=0&size=1` (`ROLE_ADMIN`).
- `can(permission)`:
  - Mock mode: full seeded permission catalog.
  - Live mode: permissions = `unknown` until `/admin/me` exists; `ROLE_ADMIN` sessions see nav items; backend still enforces method-level permissions.

## Still CONTRACT_PENDING

- `GET /admin/me` returning exact authority list for precise menu hiding.
