import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    rentalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rental",
      required: true,
      unique: true,
    },
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    evidenceVideoURL: String,
    status: {
      type: String,
      enum: ["Open", "UnderReview", "Resolved", "Rejected"],
      default: "Open",
    },
    resolutionNotes: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verdict: {
      type: String,
      enum: ["borrower_fault", "lender_fault", "mutual", "none"],
      default: "none",
    },
  },
  { timestamps: true }
);

const Dispute = mongoose.model("Dispute", disputeSchema);

export default Dispute;
