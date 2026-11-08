export type BusinessInterest = {
  id: string;
  email: string;
  source: string;
  createdAt: string;
};

export type SendBusinessInterestEmailInput = {
  subject: string;
  body: string;
  all?: boolean;
  ids?: string[];
};

export type SendBusinessInterestEmailResult = {
  sentCount: number;
  failedCount: number;
};

export type DeleteBusinessInterestsResult = {
  deletedCount: number;
};
