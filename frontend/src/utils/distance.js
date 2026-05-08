export const formatDistance = (distanceKm) => {
  if (distanceKm === null || distanceKm === undefined) return "-";
  return `${Number(distanceKm).toFixed(2)} km`;
};
