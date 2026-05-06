export const PRODUCT_TOUR_VERSION = "v1";

export type ProductTourState = {
  version: string;
  lastCompletedVersion: string | null;
  lastSkippedVersion: string | null;
  lastStartedAt: string | null;
  shouldAutoStart: boolean;
};

export type TourStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  description: string;
  accent: "teal" | "sky" | "amber" | "violet";
};

export type ProductTourSession = {
  version: string;
  index: number;
  mode: "auto" | "manual";
};
