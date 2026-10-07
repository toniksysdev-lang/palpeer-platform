# Admin CONTRACT_PENDING register

Modules marked pending until admin APIs are verified (see `admin-api-map.md` and `admin-ops-contract-v2.md`):

| Module | Reason |
|--------|--------|
| Dashboard fees / revenue | Platform has no fee model; reports summary deliberately returns no fee figures |
| Admin notification broadcast | List inventory VERIFIED (`GET /admin/notifications`); templates, receipts, push, broadcast/send still CONTRACT_PENDING (P12-06) |
| Bonus ledger settlement | Referral/bonus inventory VERIFIED (`GET /admin/referrals`, `GET /admin/bonuses`); settlement still CONTRACT_PENDING (P14-03) |
| Campaign eligibility/performance engines | Not verified |
| Promotions admin CRUD beyond create/active | Permission exists; only `GET /promotions/active` + `POST /promotions` + admin referral/bonus lists verified |
| Admin wallet funding / withdrawal | Wallet inventory VERIFIED; money-movement actions not contracted |
| Admin card funding / withdraw-from-card | Block/unblock VERIFIED (`POST /admin/cards/{id}/block|unblock`); funding still pending |
| Negotiation admin actions | Inventory/detail VERIFIED; no admin intervention endpoints |
| Admin WS/STOMP subscriptions | Not contracted; chat and negotiations use optional REST polling (15s auto-refresh toggle) |
| ~~P2P vs swap rate fields / activation~~ | Implemented (`channel`, `active`, `approvalStatus`; admin activate/approve APIs) |
| Admin MFA enrollment | Not contracted (password change + session management are VERIFIED in admin-ops-contract-v2 §7) |

UI policy: show `CONTRACT_PENDING` state — never fake live ops data.

## Verified (no longer pending)

| Module | Notes |
|--------|-------|
| Admin `/me` | `GET /admin/me` returns profile + `roleCodes` + `permissionCodes` |
| Password reset UX | `POST /auth/password-reset/request` + `/confirm` |
| Referrals / bonuses inventory | `GET /admin/referrals`, `GET /admin/bonuses` (`promotions:write`) |
| RBAC roles/permissions/admins | Full admin RBAC surface under `admin:manage` |
| Wallets inventory | `GET /admin/wallets` (`userId`, `currencyCode` filters), `/{id}`, `/{id}/transactions` (`wallets:read`) |
| Cards inventory + block/unblock | `GET /admin/cards*` (`userId`, `status` filters), `POST …/block|unblock` (`cards:read` / `cards:write`) |
| Negotiations inventory | `GET /admin/negotiations` (`userId`, `status` filters), `/{id}` (`negotiations:read`) |
| Chat inventory (REST) | `GET /admin/chat/rooms` (`userId` filter), `/{id}`, `/{id}/messages` (`chat:read`) |
| Notifications inventory | `GET /admin/notifications` (`notifications:read`); no userId on DTO |
| User search/status filters | `GET /admin/users?email=&status=` |
| KYC filters, get-by-id, media preview | `GET /admin/kyc/cases?status=&userId=`, `GET /admin/kyc/cases/{id}`, document/selfie `…/content` (authenticated fetch, audited) |
| P2P server filters | `GET /admin/p2p/requests|orders?status=&userId=` |
| Global transactions | `GET /admin/transactions`, `/{type}/{id}`, `/export` (CSV) (`transactions:read`) |
| Global search | `GET /admin/search?q=` (min 2 chars; results filtered by caller permissions) |
| Reports + dashboard aggregates | `GET /admin/reports/summary`, `GET /admin/reports/export/{dataset}` (`reports:read`) |
| Rates matrix | `GET /admin/rates/latest` |
| Operator password + sessions | `POST /auth/password/change`, `GET /auth/sessions` (`X-Refresh-Token`), `POST /auth/sessions/{id}/revoke`, `POST /auth/sessions/revoke-all` |
