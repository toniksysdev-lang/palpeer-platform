import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `MarketingAdvertResponse` from `GET /public/marketing-adverts`. */
export type MarketingAdvertResponse = {
  id: Uuid;
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaPath: string;
  sortOrder: number;
  active: boolean;
  createdAt: IsoInstant;
  updatedAt: IsoInstant | null;
};
