-- Wipe transactional / demo data while keeping Flyway history, RBAC catalog,
-- currencies, and admin-linked users.
BEGIN;

TRUNCATE TABLE
    chat_messages,
    chat_rooms,
    negotiation_offers,
    negotiations,
    p2p_orders,
    p2p_requests,
    exchange_transactions,
    exchange_quotes,
    funding_transactions,
    withdrawal_transactions,
    payment_virtual_accounts,
    ledger_entries,
    wallets,
    card_transactions,
    cards,
    kyc_documents,
    kyc_selfies,
    kyc_cases,
    notifications,
    device_tokens,
    devices,
    referrals,
    bonuses,
    promotions,
    otp_challenges,
    refresh_tokens,
    security_questions,
    pin_credentials,
    admin_user_notes,
    audit_logs,
    exchange_rates,
    profiles
RESTART IDENTITY CASCADE;

-- Remove non-admin app users (keep users referenced by admin_users).
DELETE FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM admin_users a WHERE a.user_id = u.id
);

COMMIT;
