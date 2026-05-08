import crypto from "crypto";
import { getRazorpayClient } from "../config/razorpay.js";
import AppError from "../utils/AppError.js";
import {
  createMockRazorpayOrder,
  isMockRazorpayEnabled,
  verifyMockRazorpaySignature,
} from "./mockPaymentStore.js";

export const createOrder = ({ amountInPaise, receipt }) => {
  if (isMockRazorpayEnabled()) {
    return createMockRazorpayOrder({ amountInPaise, receipt });
  }

  const razorpayClient = getRazorpayClient();
  if (!razorpayClient) {
    throw new AppError("Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.", 503);
  }
  return razorpayClient.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt,
    payment_capture: 1,
  });
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (isMockRazorpayEnabled()) {
    return verifyMockRazorpaySignature({ orderId, paymentId, signature });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
};
