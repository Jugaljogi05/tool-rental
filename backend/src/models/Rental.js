import mongoose from "mongoose";

const rentalSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    numberOfDays: {
      type: Number,
      required: true,
      min: 1,
    },
    distanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePerDay: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    rentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    latePenalty: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    depositPaid: {
      type: Boolean,
      default: false,
    },
    depositStatus: {
      type: String,
      enum: ["Unpaid", "Held", "Released", "Forfeited"],
      default: "Unpaid",
    },
    payment: {
      orderId: String,
      paymentId: String,
      signature: String,
      receiptNumber: String,
      method: String,
      paidAt: Date,
      status: {
        type: String,
        enum: ["Pending", "Paid", "Refunded", "Failed"],
        default: "Pending",
      },
    },
    borrowerBeforeVideo: {
      type: String,
      default: "",
    },
    borrowerAfterVideo: {
      type: String,
      default: "",
    },
    lenderEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    rentalStatus: {
      type: String,
      enum: [
        "Pending",
        "AwaitingPayment",
        "AwaitingPickupProof",
        "Active",
        "ReturnRequested",
        "Completed",
        "Disputed",
        "Cancelled",
      ],
      default: "Pending",
    },
    actualReturnDate: Date,
  },
  { timestamps: true }
);

rentalSchema.index({ itemId: 1, borrowerId: 1, createdAt: -1 });
rentalSchema.index({ ownerId: 1, rentalStatus: 1 });

const Rental = mongoose.model("Rental", rentalSchema);

export default Rental;
