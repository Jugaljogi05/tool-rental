import Item from "../models/Item.js";
import Rental from "../models/Rental.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { computeTrustScore } from "../utils/trustScore.js";

const recomputeUserRating = async (userId) => {
  const stats = await Review.aggregate([
    { $match: { targetUserId: userId } },
    {
      $group: {
        _id: "$targetUserId",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const average = stats[0]?.average || 0;
  const count = stats[0]?.count || 0;
  const user = await User.findById(userId);
  if (!user) return;

  user.ratingAverage = Number(average.toFixed(2));
  user.ratingCount = count;
  user.trustScore = computeTrustScore({
    ratingAverage: user.ratingAverage,
    completedRentals: user.completedRentals,
    failedDisputes: user.failedDisputes,
  });
  await user.save();
};

const recomputeItemRating = async (itemId) => {
  const stats = await Review.aggregate([
    { $match: { itemId } },
    {
      $group: {
        _id: "$itemId",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const average = stats[0]?.average || 0;
  const count = stats[0]?.count || 0;
  await Item.findByIdAndUpdate(itemId, {
    "ratings.average": Number(average.toFixed(2)),
    "ratings.count": count,
  });
};

export const createReview = catchAsync(async (req, res, next) => {
  const { rentalId, targetUserId, rating, comment } = req.body;
  if (!rentalId || !targetUserId || !rating) {
    return next(new AppError("rentalId, targetUserId and rating are required.", 400));
  }

  const rental = await Rental.findById(rentalId);
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (rental.rentalStatus !== "Completed") {
    return next(new AppError("Review allowed only after completed rental.", 409));
  }

  const reviewerId = `${req.user._id}`;
  const participants = [`${rental.borrowerId}`, `${rental.ownerId}`];
  if (!participants.includes(reviewerId)) {
    return next(new AppError("You cannot review this rental.", 403));
  }
  if (!participants.includes(`${targetUserId}`) || `${targetUserId}` === reviewerId) {
    return next(new AppError("Invalid review target for this rental.", 400));
  }

  const existingReview = await Review.findOne({ rentalId, reviewerId: req.user._id });
  let review;
  if (existingReview) {
    existingReview.targetUserId = targetUserId;
    existingReview.rating = Number(rating);
    existingReview.comment = comment;
    review = await existingReview.save();
  } else {
    review = await Review.create({
      rentalId,
      itemId: rental.itemId,
      reviewerId: req.user._id,
      targetUserId,
      rating: Number(rating),
      comment,
    });
  }

  await Promise.all([recomputeUserRating(targetUserId), recomputeItemRating(rental.itemId)]);

  res.status(201).json({
    status: "success",
    data: { review },
  });
});

export const getItemReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({ itemId: req.params.itemId })
    .populate("reviewerId", "name trustScore")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: { reviews },
  });
});
