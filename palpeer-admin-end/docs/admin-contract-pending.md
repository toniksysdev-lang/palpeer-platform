# Admin CONTRACT_PENDING register

Modules marked pending until admin APIs are verified (see `admin-api-map.md`):

| Module | Reason |
|--------|--------|
| Dashboard aggregate KPIs | No dedicated aggregate endpoints; list/page totals used where verified |
| Global transactions | Only per-user admin history exists |
| Admin notification broadcast | List inventory VERIFIED (`GET /admin/notifications`); broadcast/send still CONTRACT_PENDING (P12-06) |
| Bonus ledger settlement | Referral/bonus inventory VERIFIED (`GET /admin/referrals`, `GET /admin/bonuses`); settlement still CONTRACT_PENDING (P14-03) |
| Campaign eligibility/performance engines | Not verified |
| Promotions admin CRUD beyond create/active | Permission exists; only `GET /promotions/active` + `POST /promotions` + admin referral/bonus lists verified |
| Admin card funding / withdraw-from-card | Block/unblock VERIFIED (`POST /admin/cards/{id}/block|unblock`); funding still pending |
| Admin WS/STOMP subscriptions | REST chat inventory VERIFIED; realtime admin STOMP not verified |
| Admin transaction get-by-id | Customer detail route is owner-scoped; admin detail uses per-user list projection |
| P2P vs swap rate fields / activation | Not on ExchangeRateResponse |
| Reports | No report endpoints |
| Global search | No search endpoint (header UUID jump uses `GET /admin/users/{id}`) |
| Admin MFA / password / device session UI | Customer `/security/**` only; not admin-console contracted (shared password-reset auth APIs are VERIFIED) |
| User search/status filters | `GET /admin/users` is Pageable-only |
| KYC document/selfie preview | Admin KYC DTO lacks document fields |
| KYC get-by-id | No `GET /admin/kyc/cases/{id}`; detail uses list state/cache |
| KYC status list filters | Pageable list only; no verified status query param |

UI policy: show `CONTRACT_PENDING` state — never fake live ops data.

## Verified (no longer pending)

| Module | Notes |
|--------|-------|
| Admin `/me` | `GET /admin/me` returns profile + `roleCodes` + `permissionCodes` |
| Password reset UX | `POST /auth/password-reset/request` + `/confirm` |
| Referrals / bonuses inventory | `GET /admin/referrals`, `GET /admin/bonuses` (`promotions:write`) |
| RBAC roles/permissions/admins | Full admin RBAC surface under `admin:manage` |
| Wallets inventory | `GET /admin/wallets`, `/{id}`, `/{id}/transactions` (`wallets:read`) |
| Cards inventory + block/unblock | `GET /admin/cards*`, `POST …/block|unblock` (`cards:read` / `cards:write`) |
| Negotiations inventory | `GET /admin/negotiations`, `/{id}` (`negotiations:read`) |
| Chat inventory (REST) | `GET /admin/chat/rooms`, `/{id}`, `/{id}/messages` (`chat:read`) |
| Notifications inventory | `GET /admin/notifications` (`notifications:read`); no userId on DTO |
