const DISTANCE_SURCHARGE_PER_KM = Number(process.env.DISTANCE_SURCHARGE_PER_KM || 2);
const LATE_PENALTY_PER_DAY_MULTIPLIER = Number(
  process.env.LATE_PENALTY_PER_DAY_MULTIPLIER || 1.5
);

export const getNumberOfDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)) + 1);
};

export const calculateDistanceSurcharge = (distanceKm) =>
  Number((Math.max(0, Number(distanceKm || 0)) * DISTANCE_SURCHARGE_PER_KM).toFixed(2));

export const calculateRentAmount = ({ days, pricePerDay, distanceKm }) => {
  const baseRent = Number((days * Number(pricePerDay || 0)).toFixed(2));
  const distanceFee = calculateDistanceSurcharge(distanceKm);
  return {
    baseRent,
    distanceFee,
    rentAmount: Number((baseRent + distanceFee).toFixed(2)),
  };
};

export const calculateLatePenalty = ({ expectedEndDate, actualReturnDate, pricePerDay }) => {
  const expected = new Date(expectedEndDate);
  const returned = new Date(actualReturnDate);
  if (returned <= expected) return 0;

  const diffMs = returned - expected;
  const lateDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Number((lateDays * pricePerDay * LATE_PENALTY_PER_DAY_MULTIPLIER).toFixed(2));
};
