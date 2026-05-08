const pad = (value) => String(value).padStart(2, "0");

const formatTimestamp = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}${month}${day}-${hours}${minutes}`;
};

export const buildPaymentReceipt = ({ rental, paymentId, method = "Razorpay", isMock = false }) => {
  const now = new Date();
  const receiptNumber = `BLY-${formatTimestamp(now)}-${`${rental._id}`.slice(-5).toUpperCase()}`;
  const amount = Number(rental.totalAmount || 0);
  const rentAmount = Number(rental.rentAmount || 0);
  const depositAmount = Number(rental.depositAmount || 0);

  return {
    receiptNumber,
    paidAt: now,
    method: isMock ? "Mock Razorpay" : method,
    summary: `Payment received for ${rental.itemId?.name || "listing"} via ${isMock ? "Mock Razorpay" : method}.`,
    amount,
    rentAmount,
    depositAmount,
    paymentId,
  };
};
