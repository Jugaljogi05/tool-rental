export const computeTrustScore = ({
  ratingAverage = 0,
  completedRentals = 0,
  failedDisputes = 0,
}) => {
  const ratingComponent = (ratingAverage / 5) * 60;
  const volumeComponent = Math.min(30, completedRentals * 1.5);
  const disputePenalty = Math.min(40, failedDisputes * 8);
  return Math.max(0, Math.min(100, Math.round(ratingComponent + volumeComponent - disputePenalty)));
};
