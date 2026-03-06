import { logger } from "@/lib/logger";

type AddressInput = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

const geocodeCache = new Map<string, { lat: number; lng: number; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeAddress(value: AddressInput) {
  return `${value.street}, ${value.city}, ${value.state} ${value.zip}`.replace(/\s+/g, " ").trim();
}

function cacheKey(address: AddressInput) {
  return normalizeAddress(address).toLowerCase();
}

function getCachedCoordinates(key: string) {
  const cached = geocodeCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    geocodeCache.delete(key);
    return null;
  }

  return { lat: cached.lat, lng: cached.lng };
}

export async function geocodeAddress(address: AddressInput) {
  const key = cacheKey(address);
  const cached = getCachedCoordinates(key);
  if (cached) {
    return cached;
  }

  const query = normalizeAddress(address);
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "0",
    limit: "1",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "WindowWashOps/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      logger.warn("Geocode request failed", {
        status: response.status,
        query,
      });
      return null;
    }

    const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = payload[0];
    if (!first?.lat || !first?.lon) {
      return null;
    }

    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    geocodeCache.set(key, {
      lat,
      lng,
      cachedAt: Date.now(),
    });

    return { lat, lng };
  } catch (error) {
    logger.warn("Geocode lookup threw error", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
