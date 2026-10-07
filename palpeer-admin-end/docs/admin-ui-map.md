# Admin UI map

| Route | Page | State |
|-------|------|-------|
| `/` | Redirect → dashboard | Done |
| `/sign-in` | Sign-in | Done |
| `/forgot-password` | Password reset request + confirm | Done (verified auth APIs) |
| `/admin/dashboard` | Ops dashboard (list/page KPIs + CONTRACT_PENDING tiles) | Done |
| `/admin/users` | User list (page/sort; search CONTRACT_PENDING) | Done |
| `/admin/users/:id` | User detail + status/enabled + tx panels + audit deep-link | Done |
| `/admin/kyc` | KYC case list | Done |
| `/admin/kyc/:caseId` | KYC review (no document/selfie media) | Done |
| `/admin/wallets` | Wallet inventory (`wallets:read`, Spring page) | Done |
| `/admin/wallets/:id` | Wallet detail + ledger txs (`wallets:read`) | Done |
| `/admin/rates` | Currencies catalog, pair latest/history, publish rate, create currency | Done |
| `/admin/transactions` | Per-user recent/history | Done |
| `/admin/transactions/:id?userId=` | Transaction detail from list projection (no admin get-by-id) | Done |
| `/admin/p2p` | Requests/orders lists + status override | Done |
| `/admin/p2p/:id?kind=` | P2P request/order detail (list-backed) | Done |
| `/admin/negotiations` | Negotiation inventory (`negotiations:read`) | Done |
| `/admin/negotiations/:id` | Negotiation detail + offers | Done |
| `/admin/chat` | Chat rooms + message history (`chat:read`; STOMP pending) | Done |
| `/admin/cards` | Card inventory (`cards:read`, masked lastFour only) | Done |
| `/admin/cards/:id` | Card detail + txs + block/unblock (`cards:write`) | Done |
| `/admin/notifications` | Notification inventory (`notifications:read`); broadcast pending | Done |
| `/admin/promotions` | Active list + create (`promotions:write`) | Done |
| `/admin/referrals` | Referral + bonus inventory (`promotions:write`) | Done |
| `/admin/referrals/:id` | Referral detail + related bonuses | Done |
| `/admin/reports` | Report catalog CONTRACT_PENDING | Done |
| `/admin/audit` | Audit search (`audit:read`); supports `?userRef=` | Done |
| `/admin/admins` | Operator assign/disable (`admin:manage`, multi-role) | Done |
| `/admin/roles` | Role catalog create/edit | Done |
| `/admin/roles/:code` | Deep-link opens role editor | Done |
| `/admin/permissions` | Permission catalog | Done |
| `/admin/settings` | Profile, theme, RBAC links; MFA pending | Done |

## Shell chrome

- Sidebar primary nav filtered by permissions where coded
- Route guards via `RequireAuth` + `RequirePermission`
- Header: title, breadcrumbs, user UUID jump (`users:read`), theme, avatar
- CONTRACT_PENDING modules remain visible as shells — never invent live ops data
