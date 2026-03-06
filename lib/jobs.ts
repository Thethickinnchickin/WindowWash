import { JobStatus } from "@prisma/client";

export const WORKER_STATUS_FLOW: JobStatus[] = [
  "scheduled",
  "on_my_way",
  "in_progress",
  "finished",
  "paid",
];

export const WORKER_ALLOWED_NEXT = new Map<JobStatus, JobStatus[]>([
  ["scheduled", ["on_my_way"]],
  ["on_my_way", ["in_progress"]],
  ["in_progress", ["finished"]],
  ["finished", ["paid"]],
  ["paid", []],
  ["canceled", []],
  ["needs_attention", []],
]);

export const STATUS_TO_SMS_TEMPLATE: Partial<Record<JobStatus, SmsTemplateKey>> = {
  on_my_way: "ON_MY_WAY",
  in_progress: "STARTED",
  finished: "FINISHED",
  paid: "PAID",
};

export type SmsTemplateKey =
  | "ON_MY_WAY"
  | "STARTED"
  | "FINISHED"
  | "PAID"
  | "REMINDER_24H"
  | "REMINDER_2H"
  | "CONFIRMED"
  | "CUSTOM";

export function canWorkerTransitionStatus(from: JobStatus, to: JobStatus) {
  const allowed = WORKER_ALLOWED_NEXT.get(from) ?? [];
  return allowed.includes(to);
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatScheduleWindow(start: Date, end: Date) {
  return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function buildMapsLink(address: {
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  const query = encodeURIComponent(
    `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
  );

  return `https://maps.apple.com/?q=${query}`;
}

type RouteStopAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

function formatAddress(stop: RouteStopAddress) {
  return `${stop.street}, ${stop.city}, ${stop.state} ${stop.zip}`.replace(/\s+/g, " ").trim();
}

export function buildGoogleMapsMultiStopRouteLink(params: {
  stops: RouteStopAddress[];
  origin?: { lat: number; lng: number } | null;
}) {
  if (!params.stops.length) {
    return null;
  }

  const normalizedStops = params.stops.map((stop) => formatAddress(stop));
  const destination = normalizedStops[normalizedStops.length - 1];
  const waypoints = normalizedStops.slice(0, -1);
  const searchParams = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });

  if (params.origin && Number.isFinite(params.origin.lat) && Number.isFinite(params.origin.lng)) {
    searchParams.set("origin", `${params.origin.lat},${params.origin.lng}`);
  }

  if (waypoints.length > 0) {
    searchParams.set("waypoints", waypoints.join("|"));
  }

  return `https://www.google.com/maps/dir/?${searchParams.toString()}`;
}
