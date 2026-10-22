/**
 * Operational How-Tos for Help Center and Live Chat AI.
 * Describes only screens and behaviours that exist in the app (R-SP-2).
 * Do not invent fees, limits, or processing times — say when the app shows them.
 */

export type HowToItem = {
  id: string;
  title: string;
  /** Short user-facing answer / step list. */
  body: string;
};

export type HowToSection = {
  id: string;
  title: string;
  items: readonly HowToItem[];
};

export const OPERATIONAL_HOW_TOS: readonly HowToSection[] = [
  {
    id: 'about',
    title: 'About Palpeer',
    items: [
      {
        id: 'what-is-palpeer',
        title: 'What is Palpeer?',
        body:
          'Palpeer is a multi-currency wallet app for funding, withdrawing, InstantEX swaps between your own wallets, peer-to-peer (P2P) marketplace trades with wallet settlement, referrals/promotions, and identity verification. Open the app from Home to see balances, quick actions, KYC prompts, promotions, and recent activity.',
      },
      {
        id: 'main-tabs',
        title: 'Where do I find things?',
        body:
          'Bottom tabs: Home (balances and shortcuts), Wallets, InstantEX (Exchange), P2P marketplace, and Activity. Menu on Home opens Profile for security, KYC, cards, referrals, notifications, settings, Help, and Live Chat. The bell opens Notifications.',
      },
      {
        id: 'view-rates-signed-out',
        title: 'Can I see rates before signing in?',
        body:
          'Yes. On Welcome, tap View Best Rate Now (or open View rates). Tabs show Live P2P Rate (open marketplace offers) and InstantEX Rate (published swap rates). Signing in is required to trade or move money.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and sign-in',
    items: [
      {
        id: 'create-account',
        title: 'How do I create an account?',
        body:
          'From Welcome → Create account (Register). Enter email, phone, and password (8–128 characters). Optional Continue with Google when shown. Then verify email with the 6-digit code (valid 10 minutes, limited attempts). Phone SMS verification may be skippable if SMS delivery is not available yet.',
      },
      {
        id: 'sign-in',
        title: 'How do I sign in?',
        body:
          'Use email or phone plus password on the sign-in screen. Optional Continue with Google when configured. Biometrics only unlock an existing session saved on this phone — they are not a separate login to the server.',
      },
      {
        id: 'forgot-password',
        title: 'I forgot my password',
        body:
          'On sign-in, tap Forgot password?, enter your email, then enter the 6-digit code with your new password. Resetting signs you out on all devices. The app always shows a neutral “If the account exists…” message for privacy.',
      },
      {
        id: 'change-password',
        title: 'How do I change my password?',
        body:
          'Profile → Security → Password. Enter current and new password. Afterwards you are signed out everywhere and must sign in again.',
      },
      {
        id: 'sessions',
        title: 'How do I manage signed-in devices?',
        body:
          'Profile → Security → Active sessions. End one session or Sign out of all devices. Ending this phone’s session signs you out here. An ended session’s access token may remain valid for up to about 15 minutes.',
      },
      {
        id: 'personal-details',
        title: 'Can I change name, email, or phone?',
        body:
          'Name and address fields are edited in Profile → Personal information when available. Changing login email or phone is not done in-app yet — contact support from Help & support. Account deletion is requested from Settings → Privacy (email request when support email is configured).',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    items: [
      {
        id: 'pin',
        title: 'What is the transaction PIN?',
        body:
          'A 4–8 digit PIN set in Profile → Security. When set, the app asks for it before sensitive actions such as withdrawals, InstantEX confirm, and unfreezing a card. The PIN is never stored on the device.',
      },
      {
        id: 'forgot-pin',
        title: 'I forgot my transaction PIN',
        body:
          'Profile → Security → Forgot PIN. Answer your security questions and choose a new PIN. If you never set security questions, contact support.',
      },
      {
        id: 'pin-locked',
        title: 'My PIN is locked',
        body:
          'Too many wrong PINs or security answers lock the PIN for a while. Profile → Security shows when you can try again.',
      },
      {
        id: 'biometrics',
        title: 'Face ID / fingerprint unlock',
        body:
          'Turn on in Profile → Security if your phone supports it. It unlocks the app session on this device only. Removing this phone from Registered devices turns it off.',
      },
      {
        id: 'security-questions',
        title: 'How do I set security questions?',
        body:
          'Profile → Security → Security questions. Choose from the list (at least two). Replacing them asks for your PIN when a PIN is set.',
      },
    ],
  },
  {
    id: 'kyc',
    title: 'Identity verification',
    items: [
      {
        id: 'kyc-how',
        title: 'How do I verify my identity?',
        body:
          'Profile → Identity verification (also prompted from Home). Steps: choose document type → photograph the front of the document (camera or library) → take a live selfie → enter personal details and submit. Status updates on that screen (not started, in progress, submitted, under review, approved, or rejected with a reason).',
      },
      {
        id: 'kyc-rejected',
        title: 'My verification was rejected',
        body:
          'Open Identity verification, read the reason if shown, then upload a new document photo to try again. Photos are used only to verify identity.',
      },
      {
        id: 'kyc-required',
        title: 'Do I need KYC to use the app?',
        body:
          'You can sign in and explore without KYC. Completing verification is encouraged from Home and Profile. Some actions may depend on account checks — if the app blocks an action, follow the on-screen message or ask Live Chat / support.',
      },
    ],
  },
  {
    id: 'wallets',
    title: 'Wallets and balances',
    items: [
      {
        id: 'create-wallet',
        title: 'How do I create a wallet?',
        body:
          'Wallets tab → create, or Home quick action when you have none, or Profile flow via Create wallet. Pick a currency you do not already hold (one wallet per currency). Balances are never summed across currencies.',
      },
      {
        id: 'read-balance',
        title: 'What do available and pending mean?',
        body:
          'Available is ready to use. Pending includes amounts on hold (for example during a withdrawal or a P2P sell hold). Wallet detail shows Available, Pending, an “As of” time, ledger entries, and in-progress fundings/withdrawals.',
      },
      {
        id: 'hide-balance',
        title: 'How do I hide balances on Home?',
        body:
          'On the Home balance card, use the hide/show control. Swipe between wallets; each card is one currency only.',
      },
    ],
  },
  {
    id: 'funding',
    title: 'Fund wallet',
    items: [
      {
        id: 'fund-how',
        title: 'How do I add money?',
        body:
          'Home → Fund wallet (for the wallet on screen), or open a wallet → Fund. Enter amount → review → confirm. The payment method follows the wallet currency — there is no separate method picker.',
      },
      {
        id: 'fund-cad',
        title: 'How do I fund a CAD wallet?',
        body:
          'CAD uses Instant Interac deposit. Enter amount, choose or add the Interac email you will send from, review, then confirm. On the status screen, follow the payee, amount, and reference shown (copy available). Send the Interac from your banking app to Palpeer’s details — credit appears when the provider confirms success. The app polls status while funding is in progress.',
      },
      {
        id: 'fund-ngn',
        title: 'How do I fund an NGN wallet?',
        body:
          'NGN uses a bank transfer to a Palpeer virtual account (or one-time account details when shown). After you confirm the amount, the status screen shows account details to pay. Credit appears only when status is Success.',
      },
      {
        id: 'fund-unavailable',
        title: 'Funding isn’t available for my currency',
        body:
          'Fund is only enabled for currencies with a payment rail (currently CAD and NGN in the app). Other currencies show that funding is not available yet.',
      },
    ],
  },
  {
    id: 'withdrawal',
    title: 'Withdraw',
    items: [
      {
        id: 'withdraw-how',
        title: 'How do I withdraw?',
        body:
          'Home → Withdraw or wallet → Withdraw. Enter amount and destination → review → confirm with your transaction PIN if set. Amount cannot exceed available balance. Status is tracked on the withdrawal screen (held / complete / failed with amount released / reversed).',
      },
      {
        id: 'withdraw-cad',
        title: 'CAD withdrawal destinations',
        body:
          'CAD: Instant Interac (email or phone) or EFT (institution, transit, account as prompted). Destination is shown masked on the status screen.',
      },
      {
        id: 'withdraw-ngn',
        title: 'NGN withdrawal destinations',
        body:
          'NGN: Nigerian bank code and account number as prompted on the form.',
      },
      {
        id: 'withdraw-pending',
        title: 'Why did my available balance drop after withdraw?',
        body:
          'On submit, the amount moves to pending (hold) until the withdrawal completes or fails. If it fails or is reversed, funds return to available.',
      },
    ],
  },
  {
    id: 'exchange',
    title: 'InstantEX (swap)',
    items: [
      {
        id: 'exchange-how',
        title: 'How do I swap between my wallets?',
        body:
          'Open the InstantEX / Exchange tab (or Home → InstantEX). Choose source and target wallets (different currencies), enter an amount on either side — the other side and rate come from the server. Review shows a locked quote with a countdown; confirm with PIN if set. If the quote expires, get a new quote. You need at least two wallets in different currencies.',
      },
      {
        id: 'exchange-fees',
        title: 'Does InstantEX charge a fee?',
        body:
          'If a platform fee applies, it appears on the review screen as Platform fee with the amount and currency from the quote. If no fee line is shown, none is applied on that quote.',
      },
      {
        id: 'exchange-rates',
        title: 'Where do InstantEX rates come from?',
        body:
          'Rates are calculated by the server when you enter an amount. You can also open Currencies and rates (or public View rates → InstantEX Rate) to look up published buy/sell for a pair. The app never multiplies amounts itself.',
      },
      {
        id: 'exchange-failed',
        title: 'My InstantEX failed',
        body:
          'On failure, nothing was exchanged — balances stay as before. Open the exchange result or Activity for status and details, then try again with a fresh quote.',
      },
    ],
  },
  {
    id: 'p2p',
    title: 'P2P marketplace',
    items: [
      {
        id: 'p2p-browse',
        title: 'How do I browse P2P offers?',
        body:
          'Open the P2P tab. Filter by buy/sell side, currency, and search; sort on device. Your own listings are marked Yours. Tap a request for details. History (header) shows your requests, offers, and orders.',
      },
      {
        id: 'p2p-create',
        title: 'How do I post a P2P request?',
        body:
          'P2P → create. Choose buy or sell, base and quote currencies, amount, rate, optional expiry (presets), and notes. Sell requests temporarily hold the base amount from your wallet until accept settles, or until cancel/expiry returns the hold. Success opens your new request.',
      },
      {
        id: 'p2p-accept',
        title: 'How do I accept a P2P request?',
        body:
          'Open a request that is not yours and still Open → Accept. Confirm the summary: you need enough available balance in the funding currency. A platform fee estimate is shown before accept; you may enter a promo code or optionally apply pending bonus credit toward the fee when offered. On accept, wallets settle: base goes to the buyer and quote to the seller. Messaging opens from the order when available.',
      },
      {
        id: 'p2p-negotiate',
        title: 'How do offers / negotiation work?',
        body:
          'On an open request you do not own, tap Make an offer (or View your offer). Adjust amount/rate from the posted terms. On negotiation detail, take turns to Accept, Counter, or Decline; while waiting you can Cancel. Accept creates a P2P order with the agreed terms if the request is still Open. Live updates appear while connected.',
      },
      {
        id: 'p2p-chat',
        title: 'How do I message my P2P counterparty?',
        body:
          'From the matched order, tap Message (creates or opens the order chat). Or open Messages from the P2P tab. Chat is for that order’s two participants. Failed sends show Tap to retry. Messaging may close after the order completes.',
      },
      {
        id: 'p2p-share',
        title: 'Can I share a sell listing?',
        body:
          'When sharing is available on your sell request, use Share to send a link. Recipients who are signed out can preview; they must sign in to accept.',
      },
    ],
  },
  {
    id: 'activity',
    title: 'Activity and receipts',
    items: [
      {
        id: 'activity-how',
        title: 'How do I see my history?',
        body:
          'Activity tab lists funding, withdrawals, and InstantEX exchanges. Filter by type and period; summary shows counts and completed totals per currency for the period. Tap a row for detail (status, amounts, rate for exchanges, failure reason, progress steps). In-progress items refresh automatically. P2P history is under P2P → History.',
      },
      {
        id: 'activity-statuses',
        title: 'What do transaction statuses mean?',
        body:
          'Success means the backend completed it. Initiated / Pending / Processing mean in progress. Failed or Reversed mean it did not complete as intended (withdrawals may release held funds). Treat only Success as money moved for funding/withdrawal/exchange.',
      },
    ],
  },
  {
    id: 'cards',
    title: 'Cards',
    items: [
      {
        id: 'cards-how',
        title: 'How do cards work?',
        body:
          'Profile → Cards. Issue a card (currency, optional same-currency wallet link, optional name). Detail shows masked last four, brand, expiry — never full PAN or CVV. Freeze asks for confirmation; Unfreeze asks for confirmation and PIN if set. Cards labeled Test card use a stub issuer. Funding or withdrawing to/from a card is not available in the app yet.',
      },
    ],
  },
  {
    id: 'rewards',
    title: 'Referrals, bonuses, promotions',
    items: [
      {
        id: 'referral-how',
        title: 'How do referrals work?',
        body:
          'Profile → Invite friends. Share your code (or palpeer:// referral link). Each code is single-use; you can apply one friend’s code to your account (confirmed) — not your own. Friends who joined appear when someone used a code. Applying is never automatic from a link — the code is only pre-filled.',
      },
      {
        id: 'bonus-pending',
        title: 'Why is my bonus pending?',
        body:
          'Profile → Invite friends → Bonuses (or Bonuses screen). Pending bonuses are recorded but not spendable as wallet cash. On P2P accept, you may optionally apply pending bonus credit toward the platform fee when the app offers that switch.',
      },
      {
        id: 'promotions',
        title: 'Where are promotions?',
        body:
          'Home shows a promotions card when any are active; Profile → Promotions lists title, type, description, bonus, and period. Referral promotions link to Invite friends.',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    items: [
      {
        id: 'push-how',
        title: 'How do I turn on push notifications?',
        body:
          'Profile → Notifications (or gear in the notification center). Enable for this phone; if the OS blocked permission, open phone settings from the prompt. Remove other devices from the list if needed. The Home bell opens the in-app notification list even without push.',
      },
      {
        id: 'notif-center',
        title: 'Notification center',
        body:
          'Tap the bell on Home. Unread items show a dot; opening marks read. Referral notifications open Invite friends; others open their detail. There is no mark-all-read yet.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings and privacy',
    items: [
      {
        id: 'appearance',
        title: 'How do I change light/dark mode?',
        body:
          'Profile → Settings → Appearance: System, Light, or Dark. App version is listed on Settings.',
      },
      {
        id: 'privacy',
        title: 'Privacy and permissions',
        body:
          'Settings → Privacy explains camera/photos (KYC), biometrics (unlock), and notifications. Manage permissions in phone settings. Legal links open in the system browser when configured. Never share passwords, PINs, OTPs, or full card numbers with anyone — including support.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Help and Live Chat',
    items: [
      {
        id: 'help-center',
        title: 'Where is Help & support?',
        body:
          'Profile → Help & support, Settings → Help, or Need help? on sign-in (works signed out). Search FAQ topics, email support (pre-filled subject; do not include passwords or PINs), or call if a phone number is configured.',
      },
      {
        id: 'live-chat',
        title: 'How does Live Chat work?',
        body:
          'Profile → Live Chat. An AI assistant can use your account context (wallets, recent transactions, InstantEX rates) to help. If it cannot resolve the issue, it may offer a live agent when one is online. You can keep chatting with AI if no agent is available.',
      },
    ],
  },
];

/** Compact knowledge block appended to Live Chat AI `context`. */
export function formatOperationalGuideForAi(
  sections: readonly HowToSection[] = OPERATIONAL_HOW_TOS,
): string {
  const lines: string[] = [
    'PALPEER operational How-To knowledge (answer from this; escalate if unsure or for account disputes):',
    'Rules: Never invent fees, limits, or timelines. Never ask for passwords, PINs, OTPs, or full card numbers. Prefer in-app paths (Profile → …). Balances and rates in the user context above override generic copy when they conflict.',
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    for (const item of section.items) {
      lines.push(`Q: ${item.title}`);
      lines.push(`A: ${item.body}`);
    }
  }

  return lines.join('\n');
}
