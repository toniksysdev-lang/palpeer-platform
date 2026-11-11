import { FAQ_SECTIONS, answerHowToFromFaq, searchFaq } from '../faq';
import { formatOperationalGuideForAi, OPERATIONAL_HOW_TOS } from '../operationalHowTos';

describe('OPERATIONAL_HOW_TOS', () => {
  it('covers the main product modules', () => {
    const ids = OPERATIONAL_HOW_TOS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'about',
        'account',
        'security',
        'kyc',
        'wallets',
        'funding',
        'withdrawal',
        'fees',
        'exchange',
        'p2p',
        'activity',
        'cards',
        'rewards',
        'notifications',
        'settings',
        'support',
      ]),
    );
    expect(OPERATIONAL_HOW_TOS.every((s) => s.items.length > 0)).toBe(true);
  });

  it('formats a guide the AI can use', () => {
    const guide = formatOperationalGuideForAi();
    expect(guide).toContain('Never invent fees');
    expect(guide).toContain('## P2P marketplace');
    expect(guide).toContain('Q: How do I accept a P2P request?');
  });
});

describe('FAQ mirrors operational How-Tos', () => {
  it('keeps legacy search ids used in Help Center tests', () => {
    const ids = FAQ_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(
      expect.arrayContaining(['forgot-pin', 'forgot-password', 'bonus-pending', 'pin']),
    );
  });

  it('still finds forgot PIN and bonus answers', () => {
    expect(searchFaq('forgot PIN').flatMap((s) => s.items.map((i) => i.id))).toContain(
      'forgot-pin',
    );
    expect(searchFaq('bonus').flatMap((s) => s.items.map((i) => i.id))).toContain(
      'bonus-pending',
    );
  });

  it('answers common Live Chat phrasings from local How-Tos', () => {
    expect(answerHowToFromFaq('How do I add money?')).toMatch(/add money|fund|wallet/i);
    expect(answerHowToFromFaq('I forgot my PIN')).toMatch(/PIN|reset/i);
    expect(answerHowToFromFaq('top up my wallet', { loose: true })).toBeTruthy();
  });

  it('answers quick-chip prompts with the right How-Tos (not rivals)', () => {
    expect(answerHowToFromFaq('What are the fees?')).toMatch(/InstantEX|P2P|review screen/i);
    expect(answerHowToFromFaq('How do I withdraw money?')).toMatch(/Withdraw/i);
    expect(answerHowToFromFaq('How do I withdraw money?')).not.toMatch(/Fund wallet/i);
    expect(answerHowToFromFaq('How do I change money?')).toMatch(/InstantEX|swap|Exchange/i);
    expect(answerHowToFromFaq('How do I change money?')).not.toMatch(/My InstantEX failed/i);
    expect(answerHowToFromFaq('How do I add money?')).toMatch(/Fund/i);
  });
});
