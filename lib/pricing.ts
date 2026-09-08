export type ServicePackage = "exterior" | "interior_exterior" | "complete";
export type StoryCount = "one" | "two" | "three_plus";
export type AccessLevel = "easy" | "standard" | "difficult";
export type ServiceFrequency = "one_time" | "quarterly" | "monthly";

export type PricingInput = {
  servicePackage?: ServicePackage;
  windowCount: number;
  screenCount?: number;
  trackCount?: number;
  hardWaterWindowCount?: number;
  postConstruction?: boolean;
  stories?: StoryCount;
  accessLevel?: AccessLevel;
  frequency?: ServiceFrequency;
  city?: string;
  state?: string;
  zip?: string;
};

export type PricingLine = {
  label: string;
  amountCents: number;
};

export type PriceEstimate = {
  lines: PricingLine[];
  totalCents: number;
  depositCents: number;
  estimatedDurationMinutes: number;
  requiresReview: boolean;
  reviewReasons: string[];
};

export const servicePackages: Record<
  ServicePackage,
  { label: string; description: string; pricePerWindowCents: number }
> = {
  exterior: {
    label: "Window cleaning",
    description: "Priced by total number of windows.",
    pricePerWindowCents: 2000,
  },
  interior_exterior: {
    label: "Window cleaning",
    description: "Priced by total number of windows.",
    pricePerWindowCents: 2000,
  },
  complete: {
    label: "Window cleaning",
    description: "Priced by total number of windows.",
    pricePerWindowCents: 2000,
  },
};

export const storyOptions: Record<StoryCount, { label: string; multiplierPercent: number }> = {
  one: { label: "1 story", multiplierPercent: 0 },
  two: { label: "2 stories", multiplierPercent: 15 },
  three_plus: { label: "3+ stories", multiplierPercent: 30 },
};

export const accessOptions: Record<AccessLevel, { label: string; multiplierPercent: number }> = {
  easy: { label: "Easy access", multiplierPercent: 0 },
  standard: { label: "Some ladder work", multiplierPercent: 10 },
  difficult: { label: "Difficult access", multiplierPercent: 25 },
};

export const frequencyOptions: Record<ServiceFrequency, { label: string; discountPercent: number }> = {
  one_time: { label: "One-time", discountPercent: 0 },
  quarterly: { label: "Quarterly", discountPercent: 5 },
  monthly: { label: "Monthly", discountPercent: 10 },
};

const WINDOW_PRICE_CENTS = 2000;
const WINDOW_MINUTES = 6;

function normalizeCount(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), max);
}

function formatUnit(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function estimateDuration(input: PricingInput) {
  const windowCount = normalizeCount(input.windowCount, 300);
  const rawMinutes = 45 + windowCount * WINDOW_MINUTES;

  return Math.min(Math.max(Math.ceil(rawMinutes / 30) * 30, 60), 480);
}

export function calculateWindowWashEstimate(input: PricingInput): PriceEstimate {
  const windowCount = normalizeCount(input.windowCount, 300);
  const lines: PricingLine[] = [];
  const totalCents = windowCount * WINDOW_PRICE_CENTS;
  lines.push({
    label: `Estimated window cleaning: ${windowCount} window${windowCount === 1 ? "" : "s"} x estimated ${formatUnit(WINDOW_PRICE_CENTS)}/window`,
    amountCents: totalCents,
  });

  return {
    lines,
    totalCents,
    depositCents: 0,
    estimatedDurationMinutes: estimateDuration(input),
    requiresReview: false,
    reviewReasons: [],
  };
}

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
