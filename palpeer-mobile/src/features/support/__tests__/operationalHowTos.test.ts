import { FAQ_SECTIONS, searchFaq } from '../faq';
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
});
