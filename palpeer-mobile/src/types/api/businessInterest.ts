export type BusinessInterestResponse = {
  id: string;
  email: string;
  source: string;
  createdAt: string;
};

export type CreateBusinessInterestRequest = {
  email: string;
};
