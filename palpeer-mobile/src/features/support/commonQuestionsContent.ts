/**
 * Common questions — categories and copy aligned to the Simple Home FAQ artboard.
 * Live Chat continues to use operationalHowTos / faq.ts for AI matching.
 */

export type CommonQuestion = {
  id: string;
  question: string;
  answer: string;
  categoryId: string;
};

export type CommonQuestionCategory = {
  id: string;
  label: string;
};

export const COMMON_QUESTION_CATEGORIES: readonly CommonQuestionCategory[] = [
  { id: 'all', label: 'All' },
  { id: 'getting-started', label: 'Getting started' },
  { id: 'add-money', label: 'Add money' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'change-money', label: 'Change money' },
  { id: 'send', label: 'Send' },
  { id: 'cards', label: 'Cards' },
  { id: 'stay-safe', label: 'Stay safe' },
] as const;

export const COMMON_QUESTIONS: readonly CommonQuestion[] = [
  // Getting started (matches artifact list)
  {
    id: 'what-is-palpeer',
    categoryId: 'getting-started',
    question: 'What is Palpeer?',
    answer:
      'Palpeer is a multi-currency wallet app. Add money, change it, send it to people, withdraw it, and pay with a card — with identity checks that keep your money safe.',
  },
  {
    id: 'which-money',
    categoryId: 'getting-started',
    question: 'Which money can I use?',
    answer:
      'You can hold wallets in currencies Palpeer supports (for example Canada dollars and Naira). Each wallet is one currency. Home shows each wallet separately — we never mix them into one total.',
  },
  {
    id: 'open-account',
    categoryId: 'getting-started',
    question: 'How do I open an account?',
    answer:
      'On Welcome, tap Get started. Enter your phone and email, make a password, then check your email for a 6-digit code. After that you set a PIN and can turn on Face or Fingerprint.',
  },
  {
    id: 'complete-profile',
    categoryId: 'getting-started',
    question: 'Why must I complete my profile?',
    answer:
      'Your name and details help us protect your account and meet rules for moving money. Home and More remind you until your profile and identity check are done.',
  },
  {
    id: 'id-check-fails',
    categoryId: 'getting-started',
    question: 'What if my ID check fails?',
    answer:
      'Open My identity (or Identity on More). Read the reason if shown, then take clearer photos of your ID and a new selfie. You can try again from that screen.',
  },
  {
    id: 'business-account',
    categoryId: 'getting-started',
    question: 'Can I open a business account?',
    answer:
      'Business accounts are not ready yet. On Get started you can leave your details so we can tell you when business is available. Personal accounts work today.',
  },

  // Add money
  {
    id: 'add-money-how',
    categoryId: 'add-money',
    question: 'How do I add money?',
    answer:
      'Home → Add money for the wallet on screen. Enter the amount, review, then confirm. Canada dollars use Interac. Naira uses a bank transfer to the account details shown.',
  },
  {
    id: 'add-money-cad',
    categoryId: 'add-money',
    question: 'How do I add Canada dollars?',
    answer:
      'Add money on your CAD wallet. Follow Interac details on the status screen (payee, amount, reference). Send from your bank. Credit appears when the payment is confirmed.',
  },
  {
    id: 'add-money-ngn',
    categoryId: 'add-money',
    question: 'How do I add Naira?',
    answer:
      'Add money on your Naira wallet. The status screen shows the bank account to pay. Credit appears only when status is Success.',
  },

  // Withdraw
  {
    id: 'withdraw-how',
    categoryId: 'withdraw',
    question: 'How do I withdraw?',
    answer:
      'Home → Withdraw. No fee. Canada dollars go to your checked Interac email. Naira goes to a saved bank account. You cannot withdraw more than you have.',
  },
  {
    id: 'withdraw-limits',
    categoryId: 'withdraw',
    question: 'What are the withdraw limits?',
    answer:
      'Limits depend on currency and your account. The Withdraw screen shows the least and most you can send. Follow the amounts shown before you confirm.',
  },

  // Change money
  {
    id: 'change-how',
    categoryId: 'change-money',
    question: 'How do I change money?',
    answer:
      'Home → Change money (or Change now). Pick the wallets, enter an amount, review the rate and any fee, then confirm with your PIN if set.',
  },
  {
    id: 'change-fee',
    categoryId: 'change-money',
    question: 'Does changing money cost a fee?',
    answer:
      'If a fee applies, it appears on the review screen before you confirm. If no fee line is shown, none is applied on that quote.',
  },

  // Send
  {
    id: 'send-how',
    categoryId: 'send',
    question: 'How do I send money to someone?',
    answer:
      'Use Send on Home or open People / P2P to find a person or offer. Follow the steps for amount and rate, then confirm. Chat opens when you need to talk to the other person.',
  },

  // Cards
  {
    id: 'cards-get',
    categoryId: 'cards',
    question: 'How do I get a card?',
    answer:
      'More → My cards → Get a card. You need a wallet first. The card is for paying online in that wallet’s currency.',
  },
  {
    id: 'cards-freeze',
    categoryId: 'cards',
    question: 'How do I freeze a card?',
    answer:
      'More → My cards → open the card → Freeze. You can unfreeze later from the same place.',
  },

  // Stay safe
  {
    id: 'stay-safe-pin',
    categoryId: 'stay-safe',
    question: 'What is my PIN for?',
    answer:
      'Your 4 numbers confirm sensitive actions such as withdraw, change money, and card changes. Never share your PIN, password, or one-time codes.',
  },
  {
    id: 'stay-safe-bio',
    categoryId: 'stay-safe',
    question: 'How do I use Face or Fingerprint?',
    answer:
      'More → Settings → Face or Fingerprint, or Stay safe. Turn it on to unlock the app after idle logout without typing your password.',
  },
  {
    id: 'stay-safe-support',
    categoryId: 'stay-safe',
    question: 'Will Palpeer ask for my PIN in chat?',
    answer:
      'No. Never share your password, PIN or one-time codes with anyone, including someone who says they are from support. Use Chat with Tonia or Email support from Get help.',
  },
] as const;

export function filterCommonQuestions(
  query: string,
  categoryId: string,
): CommonQuestion[] {
  const q = query.trim().toLowerCase();
  return COMMON_QUESTIONS.filter((item) => {
    if (categoryId !== 'all' && item.categoryId !== categoryId) return false;
    if (!q) return true;
    const hay = `${item.question} ${item.answer}`.toLowerCase();
    return q.split(/\s+/).every((word) => word.length === 0 || hay.includes(word));
  });
}
