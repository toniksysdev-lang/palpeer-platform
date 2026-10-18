import type {
  CreateMarketingAdvertInput,
  MarketingAdvert,
  UpdateMarketingAdvertInput,
} from '@/types/marketing';

const now = new Date().toISOString();

let adverts: MarketingAdvert[] = [
  {
    id: 'adv-1',
    title: 'Earn more points',
    body: 'Invite friends and stack rewards every time they join and trade.',
    imageUrl:
      'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Invite & earn',
    ctaPath: '/referrals',
    sortOrder: 10,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'adv-2',
    title: 'Exchange cheaper',
    body: 'InstantEX rates that stretch your CAD ↔ NGN further — swap in seconds.',
    imageUrl:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Swap now',
    ctaPath: '/exchange',
    sortOrder: 20,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'adv-3',
    title: 'Better P2P deals',
    body: 'Buy and sell peer-to-peer at competitive rates you control.',
    imageUrl:
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Browse P2P',
    ctaPath: '/p2p',
    sortOrder: 30,
    active: true,
    createdAt: now,
    updatedAt: now,
  },
];

export function mockListMarketingAdverts(): MarketingAdvert[] {
  return adverts.map((row) => ({ ...row }));
}

export function mockCreateMarketingAdvert(input: CreateMarketingAdvertInput): MarketingAdvert {
  const created: MarketingAdvert = {
    id: `adv-${Date.now()}`,
    title: input.title.trim(),
    body: input.body.trim(),
    imageUrl: input.imageUrl.trim(),
    ctaLabel: input.ctaLabel.trim(),
    ctaPath: input.ctaPath.trim(),
    sortOrder: input.sortOrder ?? 0,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  adverts = [created, ...adverts];
  return { ...created };
}

export function mockUpdateMarketingAdvert(
  id: string,
  input: UpdateMarketingAdvertInput,
): MarketingAdvert {
  const index = adverts.findIndex((row) => row.id === id);
  if (index < 0) {
    throw new Error('Advert not found');
  }
  const current = adverts[index]!;
  const updated: MarketingAdvert = {
    ...current,
    title: input.title?.trim() ?? current.title,
    body: input.body?.trim() ?? current.body,
    imageUrl: input.imageUrl?.trim() ?? current.imageUrl,
    ctaLabel: input.ctaLabel?.trim() ?? current.ctaLabel,
    ctaPath: input.ctaPath?.trim() ?? current.ctaPath,
    sortOrder: input.sortOrder ?? current.sortOrder,
    active: input.active ?? current.active,
    updatedAt: new Date().toISOString(),
  };
  adverts[index] = updated;
  return { ...updated };
}

export function mockDeleteMarketingAdvert(id: string): void {
  adverts = adverts.filter((row) => row.id !== id);
}
