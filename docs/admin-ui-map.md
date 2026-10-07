# Admin UI map

| Route | Page | State |
|-------|------|-------|
| `/` | Redirect → dashboard | Done |
| `/sign-in` | Sign-in | Done |
| `/forgot-password` | Password reset request + confirm | Done (verified auth APIs) |
| `/admin/dashboard` | Ops dashboard: list KPIs + `GET /admin/reports/summary` cards (volume, pending KYC, balances) when `reports:read`; fees card stays unavailable (no fee model) | Done |
| `/admin/users` | User list (page/sort, `email` + `status` filters in URL) | Done |
| `/admin/users/:id` | User detail + status/enabled + tx panels + audit deep-link + permission-gated tabs (`?tab=`): wallets, KYC, cards, P2P requests/orders, negotiations, chat | Done |
| `/admin/kyc` | KYC case list (`status` tabs/select + `userId` filters, created/updated columns) | Done |
| `/admin/kyc/:caseId` | KYC detail via `GET /admin/kyc/cases/{id}`: documents + selfie preview drawer (authenticated fetch → object URL), review, timeline, audit links | Done |
| `/admin/wallets` | Wallet inventory (`wallets:read`, Spring page) | Done |
| `/admin/wallets/:id` | Wallet detail + ledger txs (`wallets:read`) | Done |
| `/admin/rates` | Currencies catalog, all pairs (latest) via `GET /admin/rates/latest`, pair latest/history, publish rate, create currency | Done |
| `/admin/transactions` | Global search `GET /admin/transactions` (type/status/currency/userId/from/to) + CSV export | Done |
| `/admin/transactions/:id?type=&userId=` | Transaction detail via `GET /admin/transactions/{type}/{id}` (legacy per-user lookup when `type` is absent) | Done |
| `/admin/p2p` | Requests/orders lists (server `status`/`userId` filters) + status override | Done |
| `/admin/p2p/:id?kind=` | P2P request/order detail (list-backed) | Done |
| `/admin/negotiations` | Negotiation inventory (`negotiations:read`); optional 15s REST auto-refresh | Done |
| `/admin/negotiations/:id` | Negotiation detail + offers; admin actions pending | Done |
| `/admin/chat` | Chat rooms + message history (`chat:read`); `?room=` opens a room; optional 15s REST auto-refresh | Done |
| `/admin/cards` | Card inventory (`cards:read`, masked lastFour only) | Done |
| `/admin/cards/:id` | Card detail + txs + block/unblock (`cards:write`) | Done |
| `/admin/notifications` | Notification inventory (`notifications:read`); broadcast pending | Done |
| `/admin/promotions` | Active list + create (`promotions:write`) | Done |
| `/admin/referrals` | Referral + bonus inventory (`promotions:write`) | Done |
| `/admin/referrals/:id` | Referral detail + related bonuses | Done |
| `/admin/reports` | Reports summary (`reports:read`, from/to window) + CSV exports per dataset (audit export needs `audit:read`) | Done |
| `/admin/audit` | Audit search (`audit:read`); supports `?userRef=`, `?entity=` | Done |
| `/admin/admins` | Operator assign/disable (`admin:manage`, multi-role) | Done |
| `/admin/roles` | Role catalog create/edit | Done |
| `/admin/roles/:code` | Deep-link opens role editor | Done |
| `/admin/permissions` | Permission catalog | Done |
| `/admin/settings` | Profile, theme, RBAC links, change password, active sessions (revoke one/all); MFA enrollment pending | Done |

## Shell chrome

- Sidebar primary nav filtered by permissions where coded (Reports needs `reports:read`); security item opens `/admin/settings#security`
- Route guards via `RequireAuth` + `RequirePermission`
- Header: breadcrumbs, debounced global search (`GET /admin/search`, min 2 chars) with results dropdown and UUID user jump fallback, theme, avatar
- CONTRACT_PENDING modules remain visible as shells — never invent live ops data
