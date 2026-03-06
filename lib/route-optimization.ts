type JobWithCoordinates = {
  id: string;
  scheduledStart: Date;
  lat: number | null;
  lng: number | null;
};

type LatLng = {
  lat: number;
  lng: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(a: LatLng, b: LatLng) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return earthRadiusKm * c;
}

function withCoordinates(job: JobWithCoordinates): job is JobWithCoordinates & { lat: number; lng: number } {
  return Number.isFinite(job.lat) && Number.isFinite(job.lng);
}

export function optimizeJobsByRoute<T extends JobWithCoordinates>(params: {
  jobs: T[];
  origin?: LatLng | null;
}) {
  const located = params.jobs.filter(withCoordinates) as Array<T & { lat: number; lng: number }>;
  const unlocated = params.jobs
    .filter((job) => !withCoordinates(job))
    .sort((left, right) => left.scheduledStart.getTime() - right.scheduledStart.getTime());

  if (!located.length) {
    return {
      jobs: [...unlocated],
      totalDistanceKm: 0,
      locatedStops: 0,
      unlocatedStops: unlocated.length,
      optimized: false,
    };
  }

  const remaining = [...located];
  const ordered: T[] = [];
  let totalDistanceKm = 0;

  let cursor: LatLng =
    params.origin && Number.isFinite(params.origin.lat) && Number.isFinite(params.origin.lng)
      ? params.origin
      : { lat: remaining[0].lat, lng: remaining[0].lng };

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = haversineKm(cursor, {
        lat: candidate.lat,
        lng: candidate.lng,
      });

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    totalDistanceKm += Number.isFinite(nearestDistance) ? nearestDistance : 0;
    cursor = { lat: next.lat, lng: next.lng };
  }

  return {
    jobs: [...ordered, ...unlocated],
    totalDistanceKm,
    locatedStops: ordered.length,
    unlocatedStops: unlocated.length,
    optimized: true,
  };
}
