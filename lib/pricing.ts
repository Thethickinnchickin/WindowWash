export type ServicePackage = "exterior" | "interior_exterior" | "complete";
export type StoryCount = "one" | "two" | "three_plus";
export type AccessLevel = "easy" | "standard" | "difficult";
export type ServiceFrequency = "one_time" | "quarterly" | "monthly";

export type PricingInput = {
  servicePackage: ServicePackage;
  windowCount: number;
  screenCount: number;
  trackCount: number;
  hardWaterWindowCount: number;
  postConstruction: boolean;
  stories: StoryCount;
  accessLevel: AccessLevel;
  frequency: ServiceFrequency;
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
    label: "Exterior only",
    description: "Outside glass cleaning for routine maintenance.",
    pricePerWindowCents: 900,
  },
  interior_exterior: {
    label: "Interior + exterior",
    description: "Inside and outside glass cleaning.",
    pricePerWindowCents: 1500,
  },
  complete: {
    label: "Complete detail",
    description: "Inside, outside, screens, tracks, and heavier detailing.",
    pricePerWindowCents: 1800,
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

const MINIMUM_JOB_CENTS = 12500;
const SCREEN_CENTS = 400;
const TRACK_CENTS = 300;
const HARD_WATER_CENTS = 1200;
const POST_CONSTRUCTION_CENTS = 1500;
const MINIMUM_DEPOSIT_CENTS = 5000;
const DEPOSIT_PERCENT = 25;

function normalizeCount(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), max);
}

function formatUnit(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function normalizeText(value?: string) {
  return (value || "").trim().toUpperCase();
}

function calculateTravelFee(input: PricingInput) {
  const state = normalizeText(input.state);
  const zip = normalizeText(input.zip);
  const city = normalizeText(input.city);
  const zipPrefix = zip.slice(0, 3);

  if (!city && !state && !zip) {
    return {
      label: "Travel zone pending address",
      amountCents: 0,
      requiresReview: false,
      reason: null,
    };
  }

  if (state && state !== "CA" && state !== "CALIFORNIA") {
    return {
      label: "Out-of-area travel review",
      amountCents: 7500,
      requiresReview: true,
      reason: "Address is outside the standard California service area.",
    };
  }

  const localCities = new Set([
    "SAN FRANCISCO",
    "DALY CITY",
    "SOUTH SAN FRANCISCO",
    "SAN MATEO",
    "OAKLAND",
    "ALAMEDA",
    "BERKELEY",
  ]);
  const localZipPrefixes = new Set(["940", "941", "944", "946", "947"]);
  const extendedZipPrefixes = new Set(["943", "945", "948", "949", "950", "951"]);

  if (localCities.has(city) || localZipPrefixes.has(zipPrefix)) {
    return {
      label: "Local service zone",
      amountCents: 0,
      requiresReview: false,
      reason: null,
    };
  }

  if (extendedZipPrefixes.has(zipPrefix)) {
    return {
      label: "Extended service zone",
      amountCents: 2500,
      requiresReview: false,
      reason: null,
    };
  }

  return {
    label: state === "CA" || state === "CALIFORNIA" ? "Regional service zone" : "Travel zone",
    amountCents: state === "CA" || state === "CALIFORNIA" ? 4500 : 3500,
    requiresReview: false,
    reason: null,
  };
}

function estimateDuration(input: PricingInput) {
  const windowCount = normalizeCount(input.windowCount, 300);
  const screenCount = normalizeCount(input.screenCount, 300);
  const trackCount = normalizeCount(input.trackCount, 300);
  const hardWaterWindowCount = normalizeCount(input.hardWaterWindowCount, 300);

  const packageMinutes =
    input.servicePackage === "exterior" ? 4 : input.servicePackage === "interior_exterior" ? 6 : 8;
  const storyMinutes = input.stories === "one" ? 0 : input.stories === "two" ? 20 : 40;
  const accessMinutes =
    input.accessLevel === "easy" ? 0 : input.accessLevel === "standard" ? 20 : 45;
  const constructionMinutes = input.postConstruction ? windowCount * 3 : 0;

  const rawMinutes =
    45 +
    windowCount * packageMinutes +
    screenCount * 2 +
    trackCount * 2 +
    hardWaterWindowCount * 8 +
    storyMinutes +
    accessMinutes +
    constructionMinutes;

  return Math.min(Math.max(Math.ceil(rawMinutes / 30) * 30, 90), 480);
}

export function calculateWindowWashEstimate(input: PricingInput): PriceEstimate {
  const windowCount = normalizeCount(input.windowCount, 300);
  const screenCount = normalizeCount(input.screenCount, 300);
  const trackCount = normalizeCount(input.trackCount, 300);
  const hardWaterWindowCount = normalizeCount(input.hardWaterWindowCount, 300);
  const servicePackage = servicePackages[input.servicePackage] ?? servicePackages.interior_exterior;
  const storyOption = storyOptions[input.stories] ?? storyOptions.one;
  const accessOption = accessOptions[input.accessLevel] ?? accessOptions.easy;
  const frequencyOption = frequencyOptions[input.frequency] ?? frequencyOptions.one_time;
  const lines: PricingLine[] = [];
  const reviewReasons: string[] = [];

  const packageTotal = windowCount * servicePackage.pricePerWindowCents;
  lines.push({
    label: `${servicePackage.label}: ${windowCount} window${windowCount === 1 ? "" : "s"} x ${formatUnit(
      servicePackage.pricePerWindowCents,
    )}`,
    amountCents: packageTotal,
  });

  if (input.servicePackage !== "complete" && screenCount > 0) {
    lines.push({
      label: `Screens: ${screenCount} x ${formatUnit(SCREEN_CENTS)}`,
      amountCents: screenCount * SCREEN_CENTS,
    });
  }

  if (input.servicePackage !== "complete" && trackCount > 0) {
    lines.push({
      label: `Tracks/sills: ${trackCount} x ${formatUnit(TRACK_CENTS)}`,
      amountCents: trackCount * TRACK_CENTS,
    });
  }

  if (hardWaterWindowCount > 0) {
    lines.push({
      label: `Hard-water removal: ${hardWaterWindowCount} x ${formatUnit(HARD_WATER_CENTS)}`,
      amountCents: hardWaterWindowCount * HARD_WATER_CENTS,
    });
  }

  if (input.postConstruction && windowCount > 0) {
    lines.push({
      label: `Post-construction cleanup: ${windowCount} x ${formatUnit(POST_CONSTRUCTION_CENTS)}`,
      amountCents: windowCount * POST_CONSTRUCTION_CENTS,
    });
    reviewReasons.push("Post-construction cleanup may require final confirmation after photos or arrival.");
  }

  const serviceSubtotal = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const storyAdjustment = Math.round(serviceSubtotal * (storyOption.multiplierPercent / 100));
  if (storyAdjustment > 0) {
    lines.push({
      label: `${storyOption.label} access adjustment (${storyOption.multiplierPercent}%)`,
      amountCents: storyAdjustment,
    });
  }

  const accessAdjustment = Math.round(serviceSubtotal * (accessOption.multiplierPercent / 100));
  if (accessAdjustment > 0) {
    lines.push({
      label: `${accessOption.label} adjustment (${accessOption.multiplierPercent}%)`,
      amountCents: accessAdjustment,
    });
  }

  const beforeMinimum = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (beforeMinimum < MINIMUM_JOB_CENTS) {
    lines.push({
      label: "Minimum appointment",
      amountCents: MINIMUM_JOB_CENTS - beforeMinimum,
    });
  }

  const beforeDiscount = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const discount = Math.round(beforeDiscount * (frequencyOption.discountPercent / 100));
  if (discount > 0) {
    lines.push({
      label: `${frequencyOption.label} service discount (${frequencyOption.discountPercent}%)`,
      amountCents: -discount,
    });
  }

  const travelFee = calculateTravelFee(input);
  lines.push({
    label: travelFee.label,
    amountCents: travelFee.amountCents,
  });
  if (travelFee.reason) {
    reviewReasons.push(travelFee.reason);
  }

  if (input.accessLevel === "difficult") {
    reviewReasons.push("Difficult access should be confirmed before charging the final balance.");
  }

  const totalCents = Math.max(0, lines.reduce((sum, line) => sum + line.amountCents, 0));
  const depositCents =
    totalCents > 0 ? Math.min(totalCents, Math.max(MINIMUM_DEPOSIT_CENTS, Math.round(totalCents * (DEPOSIT_PERCENT / 100)))) : 0;

  return {
    lines,
    totalCents,
    depositCents,
    estimatedDurationMinutes: estimateDuration(input),
    requiresReview: travelFee.requiresReview || reviewReasons.length > 0,
    reviewReasons,
  };
}

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
