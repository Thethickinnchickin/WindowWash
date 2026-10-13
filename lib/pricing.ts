export type ServicePackage = "exterior" | "interior_exterior" | "complete";
export type StoryCount = "one" | "two" | "three_plus";
export type GutterStoryCount = "none" | "one" | "two";
export type AccessLevel = "easy" | "standard" | "difficult";
export type ServiceFrequency = "one_time" | "quarterly" | "monthly";

export type PricingInput = {
  servicePackage?: ServicePackage;
  windowCount: number;
  gutterStories?: GutterStoryCount;
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
  amountRangeCents?: {
    minCents: number;
    maxCents: number;
  };
};

export type PriceEstimate = {
  lines: PricingLine[];
  totalCents: number;
  totalRangeCents?: {
    minCents: number;
    maxCents: number;
  };
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

export const gutterStoryOptions: Record<
  GutterStoryCount,
  { label: string; minCents: number; maxCents: number; durationMinutes: number }
> = {
  none: { label: "No gutter cleaning", minCents: 0, maxCents: 0, durationMinutes: 0 },
  one: { label: "1 story gutter cleaning", minCents: 15000, maxCents: 25000, durationMinutes: 90 },
  two: { label: "2 story gutter cleaning", minCents: 25000, maxCents: 40000, durationMinutes: 150 },
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

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCentsRange(minCents: number, maxCents: number) {
  if (minCents === maxCents) {
    return formatCents(minCents);
  }

  return `${formatCents(minCents)} - ${formatCents(maxCents)}`;
}

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
  const gutterStories = input.gutterStories ?? "none";
  const gutterStoryMinutes = gutterStoryOptions[gutterStories]?.durationMinutes ?? 0;
  const rawMinutes = 45 + windowCount * WINDOW_MINUTES + gutterStoryMinutes;

  return Math.min(Math.max(Math.ceil(rawMinutes / 30) * 30, 60), 480);
}

export function calculateWindowWashEstimate(input: PricingInput): PriceEstimate {
  const windowCount = normalizeCount(input.windowCount, 300);
  const gutterStories = input.gutterStories ?? "none";
  const gutterStoryOption = gutterStoryOptions[gutterStories];
  const lines: PricingLine[] = [];
  const windowTotalCents = windowCount * WINDOW_PRICE_CENTS;
  const hasStoryBasedGutters = gutterStoryOption && gutterStories !== "none";
  const gutterMinCents = hasStoryBasedGutters ? gutterStoryOption.minCents : 0;
  const gutterMaxCents = hasStoryBasedGutters ? gutterStoryOption.maxCents : 0;
  const totalMinCents = windowTotalCents + gutterMinCents;
  const totalMaxCents = windowTotalCents + gutterMaxCents;

  if (windowCount > 0) {
    lines.push({
      label: `Estimated window cleaning: ${windowCount} window${windowCount === 1 ? "" : "s"} x estimated ${formatUnit(WINDOW_PRICE_CENTS)}/window`,
      amountCents: windowTotalCents,
    });
  }

  if (hasStoryBasedGutters) {
    lines.push({
      label: `Estimated gutter cleaning: ${gutterStoryOption.label}`,
      amountCents: gutterStoryOption.minCents,
      amountRangeCents: {
        minCents: gutterStoryOption.minCents,
        maxCents: gutterStoryOption.maxCents,
      },
    });
  }

  return {
    lines,
    totalCents: totalMinCents,
    totalRangeCents:
      totalMaxCents > totalMinCents
        ? {
            minCents: totalMinCents,
            maxCents: totalMaxCents,
          }
        : undefined,
    depositCents: 0,
    estimatedDurationMinutes: estimateDuration(input),
    requiresReview: false,
    reviewReasons: [],
  };
}
