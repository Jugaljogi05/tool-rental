import Rental from "../models/Rental.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { createOrder, verifyRazorpaySignature } from "../services/paymentService.js";
import { createNotification } from "../services/notificationService.js";
import { buildPaymentReceipt } from "../services/paymentReceiptService.js";
import { isMockAuthEnabled, updateMockUserBalance } from "../services/mockAuthStore.js";

export const createRentalOrder = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.id).populate("itemId", "name");
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.borrowerId}` !== `${req.user._id}`) {
    return next(new AppError("Only borrower can initiate payment.", 403));
  }
  if (rental.rentalStatus !== "AwaitingPayment") {
    return next(new AppError("Rental is not waiting for payment.", 409));
  }

  const amountInPaise = Math.round(rental.totalAmount * 100);
  const order = await createOrder({
    amountInPaise,
    receipt: `rental_${rental._id}_${Date.now()}`,
  });

  rental.payment.orderId = order.id;
  rental.payment.status = "Pending";
  await rental.save();

  res.status(200).json({
    status: "success",
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: order.isMock ? "rzp_test_mock" : process.env.RAZORPAY_KEY_ID,
      isMock: Boolean(order.isMock),
      mockPaymentId: order.mockPaymentId || "",
      signature: order.signature || "",
    },
  });
});

export const verifyRentalPayment = catchAsync(async (req, res, next) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    return next(new AppError("orderId, paymentId and signature are required.", 400));
  }

  const rental = await Rental.findById(req.params.id).populate("itemId", "name");
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.borrowerId}` !== `${req.user._id}`) {
    return next(new AppError("Only borrower can verify payment.", 403));
  }
  if (rental.payment.orderId !== orderId) {
    return next(new AppError("Order mismatch for this rental.", 400));
  }

  const isValid = verifyRazorpaySignature({ orderId, paymentId, signature });
  if (!isValid) {
    rental.payment.status = "Failed";
    await rental.save();
    return next(new AppError("Payment verification failed.", 400));
  }

  const isMock = `${process.env.MOCK_RAZORPAY || "false"}`.toLowerCase() === "true" && `${paymentId}`.startsWith("pay_mock_");
  const receipt = buildPaymentReceipt({
    rental,
    paymentId,
    method: isMock ? "Mock Razorpay" : "Razorpay",
    isMock,
  });

  rental.payment.paymentId = paymentId;
  rental.payment.signature = signature;
  rental.payment.receiptNumber = receipt.receiptNumber;
  rental.payment.method = receipt.method;
  rental.payment.paidAt = receipt.paidAt;
  rental.payment.status = "Paid";
  rental.depositPaid = true;
  rental.depositStatus = "Held";
  rental.lenderEarnings = Number(Number(rental.rentAmount || 0).toFixed(2));
  rental.rentalStatus = "AwaitingPickupProof";
  await rental.save();

  if (isMockAuthEnabled()) {
    updateMockUserBalance(rental.ownerId, rental.rentAmount || 0);
  } else {
    await User.findByIdAndUpdate(rental.ownerId, {
      $inc: { lenderBalance: Number(rental.rentAmount || 0) },
    });
  }

  await createNotification({
    userId: rental.borrowerId,
    type: "success",
    title: "Payment receipt generated",
    message: `${receipt.receiptNumber} - ${receipt.summary}`,
    metadata: { rentalId: rental._id, receiptNumber: receipt.receiptNumber, amount: receipt.amount },
  });

  await createNotification({
    userId: rental.ownerId,
    type: "success",
    title: "Payment completed",
    message: `Borrower payment confirmed. Receipt ${receipt.receiptNumber}. Earnings updated to INR ${rental.lenderEarnings}.`,
    metadata: {
      rentalId: rental._id,
      receiptNumber: receipt.receiptNumber,
      lenderEarnings: rental.lenderEarnings,
      amount: receipt.amount,
    },
  });

  res.status(200).json({
    status: "success",
    message: "Payment verified successfully.",
    data: { rental },
    meta: {
      receipt,
      lenderEarnings: rental.lenderEarnings,
    },
  });
});
