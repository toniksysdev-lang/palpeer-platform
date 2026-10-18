export type MarketingAdvert = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaPath: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateMarketingAdvertInput = {
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaPath: string;
  sortOrder?: number;
  active?: boolean;
};

export type UpdateMarketingAdvertInput = Partial<CreateMarketingAdvertInput>;
