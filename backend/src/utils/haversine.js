const EARTH_RADIUS_KM = 6371;

const toRadians = (deg) => (deg * Math.PI) / 180;

export const haversineDistanceKm = (pointA, pointB) => {
  const lat1 = Number(pointA?.lat);
  const lng1 = Number(pointA?.lng);
  const lat2 = Number(pointB?.lat);
  const lng2 = Number(pointB?.lng);

  if ([lat1, lng1, lat2, lng2].some((v) => Number.isNaN(v))) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};
