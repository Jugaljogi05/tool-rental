import crypto from "crypto";

const mockOrders = new Map();

export const isMockRazorpayEnabled = () =>
  `${process.env.MOCK_RAZORPAY || process.env.MOCK_AUTH || process.env.SKIP_DB || "false"}`.toLowerCase() ===
  "true";

const getMockSecret = () =>
  process.env.MOCK_RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET || "mock_razorpay_secret";

const buildSignature = (orderId, paymentId) =>
  crypto.createHmac("sha256", getMockSecret()).update(`${orderId}|${paymentId}`).digest("hex");

export const createMockRazorpayOrder = ({ amountInPaise, receipt, rentalId }) => {
  const orderId = `order_mock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const paymentId = `pay_mock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const signature = buildSignature(orderId, paymentId);

  const order = {
    id: orderId,
    amount: amountInPaise,
    currency: "INR",
    receipt,
    status: "created",
    isMock: true,
    rentalId: rentalId ? `${rentalId}` : "",
    mockPaymentId: paymentId,
    signature,
    createdAt: new Date(),
  };

  mockOrders.set(orderId, order);
  return order;
};

export const verifyMockRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const order = mockOrders.get(`${orderId}`);
  if (!order) return false;

  const expectedSignature = order.signature || buildSignature(order.id, order.mockPaymentId);
  return `${order.mockPaymentId}` === `${paymentId}` && expectedSignature === `${signature}`;
};

export const getMockRazorpayOrder = (orderId) => mockOrders.get(`${orderId}`) || null;
