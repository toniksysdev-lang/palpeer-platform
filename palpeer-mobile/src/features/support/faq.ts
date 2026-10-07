/**
 * Help-center answers. Each one describes a screen or behaviour the app actually has (see
 * docs/mobile-business-rules.md); nothing here states fees, limits or timelines the backend
 * doesn't define. Product must approve the wording before release (SP-1).
 */
export type FaqItem = { id: string; question: string; answer: string };
export type FaqSection = { id: string; title: string; items: readonly FaqItem[] };

export const FAQ_SECTIONS: readonly FaqSection[] = [
  {
    id: 'account',
    title: 'Account and sign-in',
    items: [
      {
        id: 'forgot-password',
        question: 'I forgot my password',
        answer:
          'On the sign-in screen, tap "Forgot password?" and enter your email. We send a 6-digit code that expires after 10 minutes. Enter it with your new password. Resetting your password signs you out on all devices.',
      },
      {
        id: 'change-password',
        question: 'How do I change my password?',
        answer:
          'Go to Profile → Security → Password. You need your current password. Afterwards you are signed out everywhere, including this phone, and sign in again with the new password.',
      },
      {
        id: 'lost-phone',
        question: 'I lost my phone or think someone else is signed in',
        answer:
          'Sign in on another device, open Profile → Security → Active sessions and choose "Sign out of all devices". Then change your password. A device that was already open may keep access for up to 15 minutes.',
      },
      {
        id: 'personal-details',
        question: 'Can I change my name, email or phone number?',
        answer:
          'Not in the app yet. Contact support if your details need to change, using the options below.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    items: [
      {
        id: 'pin',
        question: 'What is the transaction PIN for?',
        answer:
          'Once set, the app asks for your PIN before sensitive actions such as withdrawals, exchanges and unfreezing a card. Set it up or change it in Profile → Security.',
      },
      {
        id: 'forgot-pin',
        question: 'I forgot my transaction PIN',
        answer:
          'Go to Profile → Security → Forgot PIN and answer your security questions to choose a new PIN. If you never set up security questions, contact support.',
      },
      {
        id: 'pin-locked',
        question: 'My PIN is locked',
        answer:
          'After too many wrong PINs or wrong security answers, the PIN is locked for a while. The Security screen shows when you can try again.',
      },
      {
        id: 'biometrics',
        question: 'Can I unlock the app with Face ID or my fingerprint?',
        answer:
          'Yes, if your phone supports it and it is set up in your phone settings. Turn it on in Profile → Security. Removing this phone from Registered devices turns it off.',
      },
    ],
  },
  {
    id: 'verification',
    title: 'Identity verification',
    items: [
      {
        id: 'kyc-how',
        question: 'How do I verify my identity?',
        answer:
          'Go to Profile → Identity verification. Choose a document type, photograph the front of the document, take a selfie, then submit for review. Your current status is shown on that screen.',
      },
      {
        id: 'kyc-photos',
        question: 'What happens to my photos?',
        answer: 'They are sent securely and used only to verify your identity.',
      },
    ],
  },
  {
    id: 'cards',
    title: 'Cards',
    items: [
      {
        id: 'freeze',
        question: 'How do I freeze a card?',
        answer:
          'Open Profile → Cards, choose the card and tap "Freeze card". It stays frozen until you unfreeze it, which asks for your PIN.',
      },
    ],
  },
  {
    id: 'rewards',
    title: 'Referrals and bonuses',
    items: [
      {
        id: 'referral-code',
        question: 'How do referral codes work?',
        answer:
          "Share your code from Profile → Invite friends. Each code can be used once, and you can apply one friend's code to your own account. You can't use your own code.",
      },
      {
        id: 'bonus-pending',
        question: 'Why is my bonus pending?',
        answer:
          "Bonuses are recorded when a referral completes, but they can't be spent yet. They are shown as pending until they are paid out.",
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    items: [
      {
        id: 'push',
        question: "I'm not getting push notifications",
        answer:
          'Turn them on in Profile → Notifications. If notifications are blocked for PALPEER in your phone settings, the app offers a shortcut to change that. You can always see your notifications from the bell on Home.',
      },
    ],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();
}

/** Sections whose questions or answers contain every word of the query. */
export function searchFaq(
  query: string,
  sections: readonly FaqSection[] = FAQ_SECTIONS,
): FaqSection[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [...sections];
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const text = normalize(`${item.question} ${item.answer}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.items.length > 0);
}
