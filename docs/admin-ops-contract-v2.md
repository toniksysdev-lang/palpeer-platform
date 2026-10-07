# Admin ops contract v2 (pending-module completion)

All paths are under `/api/v1`. Responses use the existing `ApiResponse<T>` envelope (the admin UI client unwraps `data`), except CSV and binary downloads, which return raw bodies. Every `/admin/**` controller keeps class-level `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` plus the method-level permission listed. List endpoints return Spring `Page<T>` (`content`, `totalElements`, `totalPages`, `size`, `number`, `numberOfElements`, `first`, `last`, `empty`) unless marked "List".

These endpoints are read-only projections of data the platform already stores. They add no financial, eligibility, or settlement rules.

## 1. Filters on existing admin lists

| Method | Path | New query params | Permission |
|---|---|---|---|
| GET | `/admin/users` | `email` (case-insensitive contains), `status` (`PENDING_VERIFICATION`/`ACTIVE`/`SUSPENDED`/`CLOSED`) + pageable | `users:read` |
| GET | `/admin/kyc/cases` | `status` (KycStatus), `userId` + pageable | `kyc:read` |
| GET | `/admin/wallets` | `userId`, `currencyCode` + pageable | `wallets:read` |
| GET | `/admin/cards` | `userId`, `status` + pageable | `cards:read` |
| GET | `/admin/negotiations` | `userId` (requester or counterparty), `status` + pageable | `negotiations:read` |
| GET | `/admin/chat/rooms` | `userId` (either participant) + pageable | `chat:read` |
| GET | `/admin/p2p/requests` | `status`, `userId` (List, unchanged shape) | `p2p:read` |
| GET | `/admin/p2p/orders` | `status`, `userId` (requester or acceptor) (List, unchanged shape) | `p2p:read` |

All params are optional. With no params, behavior is unchanged.

Admin card responses (`/admin/cards`, `/admin/cards/{id}`, block/unblock) add **`userId`** to the existing CardResponse fields (admin-only DTO `AdminCardResponse`; customer DTO unchanged).

KYC list items (`KycStatusResponse` on admin endpoints) add **`createdAt`**, **`updatedAt`** (ISO instants).

## 2. KYC case detail and documents

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/admin/kyc/cases/{caseId}` | `kyc:read` | `AdminKycCaseDetailResponse` |
| GET | `/admin/kyc/cases/{caseId}/documents/{documentId}/content` | `kyc:read` | Raw bytes, `Content-Type` = stored type, `Content-Disposition: inline`. Audited as `ADMIN_KYC_DOCUMENT_VIEW` |
| GET | `/admin/kyc/cases/{caseId}/selfie/content` | `kyc:read` | Raw bytes. Audited as `ADMIN_KYC_SELFIE_VIEW`. 404 if none |

`AdminKycCaseDetailResponse`:
```
{ caseId, userId, status, rejectionReason, createdAt, updatedAt,
  documents: [{ id, documentType, contentType, originalFilename, sizeBytes, createdAt }],
  selfie: { id, contentType, originalFilename, sizeBytes, createdAt } | null }
```
Storage keys and provider ids are never returned.

## 3. Global transactions

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/transactions` | `transactions:read` |
| GET | `/admin/transactions/{type}/{id}` | `transactions:read` |
| GET | `/admin/transactions/export` | `transactions:read` (text/csv) |

Query for list/export: `type` (`FUNDING`/`WITHDRAWAL`/`EXCHANGE`), `status`, `currencyCode`, `userId`, `from`, `to` (ISO instants), `page`, `size` (default 20, max 100). Export ignores paging and caps at 5,000 rows.

List returns the existing `TransactionPageResponse` shape (`items`, `page`, `size`, `totalElements`, `totalPages`). `TransactionItemResponse` gains a nullable **`userId`** (populated on admin endpoints; customer endpoints may leave it null). Newest first.

## 4. Global search

`GET /admin/search?q=` (min 2 chars), permission `ROLE_ADMIN` (results filtered by caller permissions):
```
{ query,
  users: [AdminUserSummaryResponse] (email or phone contains q, max 10, needs users:read),
  matches: [{ type, id, label, path }] }
```
When `q` is a UUID, `matches` lists every entity with that id the caller can read. Types: `USER`, `WALLET`, `CARD`, `KYC_CASE`, `P2P_REQUEST`, `P2P_ORDER`, `NEGOTIATION`, `CHAT_ROOM`, `REFERRAL`, `TRANSACTION`. `path` is the admin UI route, for example `/admin/wallets/{id}` or `/admin/p2p/{id}?kind=order` or `/admin/transactions/{id}?userId={userId}&type={type}`.

## 5. Reports and dashboard aggregates

New permission **`reports:read`** (granted to SUPER_ADMIN).

`GET /admin/reports/summary?from=&to=` (default window: last 30 days; counts of users/KYC/cards/wallets are all-time totals, transaction figures use the window):
```
{ generatedAt, from, to,
  users: { total, byStatus: { STATUS: count } },
  kyc: { total, byStatus: { STATUS: count } },
  wallets: { total, balancesByCurrency: [{ currencyCode, walletCount, availableTotal, pendingTotal }] },
  transactions: { countsByType: { TYPE: n }, countsByTypeAndStatus: { "TYPE:STATUS": n },
                  successVolume: [{ type, currencyCode, count, amount }] },
  p2p: { requestsByStatus: {}, ordersByStatus: {} },
  cards: { byStatus: {} },
  referrals: { byStatus: {} },
  bonuses: { byStatus: {}, amountByStatusAndCurrency: [{ status, currencyCode, amount }] } }
```
`successVolume` covers FUNDING and WITHDRAWAL with status SUCCESS (sum of `amount`) and EXCHANGE with status SUCCESS (sum of source `amount` per source currency), matching the P11-04 customer summary definition. No fee or revenue figures: the platform has no fee model.

`GET /admin/reports/export/{dataset}?from=&to=` returns text/csv, max 5,000 rows, permission `reports:read`. Datasets: `users`, `kyc-cases`, `wallets`, `transactions`, `p2p-requests`, `p2p-orders`, `audit-logs` (audit also needs `audit:read`). `from`/`to` filter on `createdAt` where applicable. Filename `palpeer-{dataset}-{yyyyMMdd}.csv`.

## 6. Rates matrix

`GET /admin/rates/latest` (ROLE_ADMIN), List of `ExchangeRateResponse`: the latest effective rate for every base/quote pair.

## 7. Operator account security (own account, any authenticated user)

| Method | Path | Body / response |
|---|---|---|
| POST | `/auth/password/change` | `{ currentPassword, newPassword }` → 200. Uses the same password validation as registration/reset. Revokes all refresh tokens for the user. Audited `SECURITY_PASSWORD_CHANGE` |
| GET | `/auth/sessions` | List `[{ id, createdAt, expiresAt, current }]` of the caller's non-revoked, non-expired refresh tokens. `current` true when it matches the `X-Refresh-Token` request header hash (optional header) |
| POST | `/auth/sessions/{id}/revoke` | Revoke one of the caller's sessions |
| POST | `/auth/sessions/revoke-all` | Revoke all of the caller's refresh tokens |

Token hashes are never returned.
