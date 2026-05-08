import path from "path";
import Dispute from "../models/Dispute.js";
import Item from "../models/Item.js";
import Rental from "../models/Rental.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { computeTrustScore } from "../utils/trustScore.js";
import { isMockAuthEnabled, updateMockUserBalance } from "../services/mockAuthStore.js";

const getVideoUrl = (req) => {
  if (!req.file) return "";
  const normalized = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
  return `${process.env.UPLOAD_BASE_URL || ""}/${normalized}`;
};

const recomputeTrust = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;
  user.trustScore = computeTrustScore({
    ratingAverage: user.ratingAverage,
    completedRentals: user.completedRentals,
    failedDisputes: user.failedDisputes,
  });
  await user.save();
};

export const createDispute = catchAsync(async (req, res, next) => {
  const { rentalId, reason } = req.body;
  if (!rentalId || !reason) return next(new AppError("rentalId and reason are required.", 400));

  const rental = await Rental.findById(rentalId).populate("itemId");
  if (!rental) return next(new AppError("Rental not found.", 404));
  const isBorrower = `${rental.borrowerId}` === `${req.user._id}`;
  const isOwner = `${rental.ownerId}` === `${req.user._id}`;
  if (!isBorrower && !isOwner) {
    return next(new AppError("You are not allowed to raise dispute for this rental.", 403));
  }
  if (!["Active", "ReturnRequested", "Completed"].includes(rental.rentalStatus)) {
    return next(new AppError("Dispute cannot be raised at current rental status.", 409));
  }

  const existing = await Dispute.findOne({ rentalId });
  if (existing) return next(new AppError("A dispute already exists for this rental.", 409));

  const dispute = await Dispute.create({
    rentalId,
    openedBy: req.user._id,
    reason,
    evidenceVideoURL: getVideoUrl(req),
  });

  rental.rentalStatus = "Disputed";
  await rental.save();

  if (rental.itemId) {
    await Item.findByIdAndUpdate(rental.itemId._id, { availabilityStatus: "Blocked" });
  }

  res.status(201).json({
    status: "success",
    data: { dispute },
  });
});

export const getDisputes = catchAsync(async (req, res) => {
  const filter =
    req.user.role === "admin"
      ? {}
      : {
          $or: [{ openedBy: req.user._id }],
        };
  if (req.query.status) filter.status = req.query.status;

  const disputes = await Dispute.find(filter)
    .populate("openedBy", "name email")
    .populate("resolvedBy", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: disputes.length,
    data: { disputes },
  });
});

export const resolveDispute = catchAsync(async (req, res, next) => {
  const { status, verdict, resolutionNotes } = req.body;
  if (!["Resolved", "Rejected"].includes(status)) {
    return next(new AppError("status must be Resolved or Rejected.", 400));
  }
  if (!["borrower_fault", "lender_fault", "mutual", "none"].includes(verdict)) {
    return next(new AppError("Invalid verdict.", 400));
  }

  const dispute = await Dispute.findById(req.params.id);
  if (!dispute) return next(new AppError("Dispute not found.", 404));
  if (dispute.status === "Resolved") {
    return next(new AppError("Dispute already resolved.", 409));
  }

  const rental = await Rental.findById(dispute.rentalId).populate("itemId");
  if (!rental) return next(new AppError("Rental not found for this dispute.", 404));

  dispute.status = status;
  dispute.verdict = verdict;
  dispute.resolutionNotes = resolutionNotes || "";
  dispute.resolvedBy = req.user._id;
  await dispute.save();

  if (status === "Resolved") {
    rental.rentalStatus = "Completed";
    if (verdict === "borrower_fault") {
      rental.depositStatus = "Forfeited";
      await User.findByIdAndUpdate(rental.borrowerId, { $inc: { failedDisputes: 1 } });
      await recomputeTrust(rental.borrowerId);
    } else {
      const refundAmount = Number(rental.lenderEarnings || rental.rentAmount || 0);
      rental.depositStatus = "Released";
      rental.payment.status = "Refunded";
      rental.lenderEarnings = 0;
      if (refundAmount > 0) {
        if (isMockAuthEnabled()) {
          updateMockUserBalance(rental.ownerId, -refundAmount);
        } else {
          await User.findByIdAndUpdate(rental.ownerId, {
            $inc: { lenderBalance: -refundAmount },
          });
        }
      }
      if (verdict === "lender_fault") {
        await User.findByIdAndUpdate(rental.ownerId, { $inc: { failedDisputes: 1 } });
        await recomputeTrust(rental.ownerId);
      }
    }
  }

  await rental.save();
  if (rental.itemId) {
    rental.itemId.availabilityStatus = "Available";
    await rental.itemId.save();
  }

  res.status(200).json({
    status: "success",
    data: { dispute, rental },
  });
});
