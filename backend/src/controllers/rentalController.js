import path from "path";
import Item from "../models/Item.js";
import Rental from "../models/Rental.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { calculateLatePenalty, calculateRentAmount, getNumberOfDays } from "../utils/pricing.js";
import { createNotification } from "../services/notificationService.js";
import { isMockAuthEnabled, updateMockUserBalance } from "../services/mockAuthStore.js";

const OVERDUE_STATUSES = new Set(["AwaitingPickupProof", "Active", "ReturnRequested"]);

const buildOverdueMeta = (rental) => {
  const endDate = new Date(rental.endDate);
  const now = new Date();
  const referenceDate =
    rental.rentalStatus === "ReturnRequested" && rental.actualReturnDate
      ? new Date(rental.actualReturnDate)
      : now;

  const isOverdue = OVERDUE_STATUSES.has(rental.rentalStatus) && referenceDate > endDate;
  if (!isOverdue) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      estimatedLatePenalty: 0,
      overdueMessage: "",
    };
  }

  const daysOverdue = Math.max(1, Math.ceil((referenceDate - endDate) / (24 * 60 * 60 * 1000)));
  const estimatedLatePenalty = calculateLatePenalty({
    expectedEndDate: rental.endDate,
    actualReturnDate: referenceDate,
    pricePerDay: rental.pricePerDay,
  });

  return {
    isOverdue: true,
    daysOverdue,
    estimatedLatePenalty,
    overdueMessage: `This rental is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue. Estimated late fine: INR ${estimatedLatePenalty}.`,
  };
};

const decorateRental = (rentalDoc) => {
  const rental = typeof rentalDoc.toObject === "function" ? rentalDoc.toObject() : { ...rentalDoc };
  return {
    ...rental,
    ...buildOverdueMeta(rental),
  };
};

const getVideoUrl = (req) => {
  if (!req.file) return "";
  const normalized = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
  return `${process.env.UPLOAD_BASE_URL || ""}/${normalized}`;
};

const getRentalWithAccessCheck = async ({ rentalId, userId }) => {
  const rental = await Rental.findById(rentalId).populate("itemId");
  if (!rental) throw new AppError("Rental not found.", 404);
  const allowed =
    `${rental.borrowerId}` === `${userId}` ||
    `${rental.ownerId}` === `${userId}` ||
    `${userId}` === `${rental.itemId?.ownerId}`; // safety for older records
  if (!allowed) throw new AppError("Unauthorized rental access.", 403);
  return rental;
};

export const createRentalRequest = catchAsync(async (req, res, next) => {
  const { itemId, startDate, endDate } = req.body;
  if (!itemId || !startDate || !endDate) {
    return next(new AppError("itemId, startDate and endDate are required.", 400));
  }

  const item = await Item.findById(itemId);
  if (!item || !item.isActive) return next(new AppError("Item not found.", 404));
  if (item.availabilityStatus !== "Available") {
    return next(new AppError("Item is currently unavailable.", 409));
  }
  if (`${item.ownerId}` === `${req.user._id}`) {
    return next(new AppError("You cannot rent your own item.", 400));
  }

  const overlapping = await Rental.findOne({
    itemId,
    rentalStatus: { $in: ["Pending", "AwaitingPayment", "AwaitingPickupProof", "Active", "ReturnRequested"] },
  });
  if (overlapping) {
    return next(new AppError("Item already has an active/pending rental.", 409));
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return next(new AppError("Invalid date format for startDate or endDate.", 400));
  }
  if (start.setHours(0, 0, 0, 0) < now.setHours(0, 0, 0, 0)) {
    return next(new AppError("Start date cannot be in the past.", 400));
  }
  if (end < start) {
    return next(new AppError("endDate must be after startDate.", 400));
  }

  const borrowerLocation = req.user.location;
  if (borrowerLocation?.lat === undefined || borrowerLocation?.lng === undefined) {
    return next(new AppError("Borrower location is required. Update your profile location.", 400));
  }

  const [itemLng, itemLat] = item.location.coordinates;
  const distanceKm = Number(
    haversineDistanceKm(borrowerLocation, { lat: itemLat, lng: itemLng }).toFixed(2)
  );
  const allowedRadius = Number(process.env.DEFAULT_RADIUS_KM || 5);
  if (distanceKm > allowedRadius) {
    return next(new AppError(`Item is outside ${allowedRadius} km service radius.`, 400));
  }

  const numberOfDays = getNumberOfDays(startDate, endDate);
  const { rentAmount } = calculateRentAmount({
    days: numberOfDays,
    pricePerDay: item.pricePerDay,
    distanceKm,
  });
  const totalAmount = Number((rentAmount + item.depositAmount).toFixed(2));

  const rental = await Rental.create({
    itemId: item._id,
    borrowerId: req.user._id,
    ownerId: item.ownerId,
    startDate,
    endDate,
    numberOfDays,
    distanceKm,
    pricePerDay: item.pricePerDay,
    depositAmount: item.depositAmount,
    rentAmount,
    totalAmount,
    rentalStatus: "Pending",
  });

  await createNotification({
    userId: item.ownerId,
    type: "info",
    title: "New rental request",
    message: `${req.user.name} requested ${item.name}.`,
    metadata: { rentalId: rental._id },
  });

  res.status(201).json({
    status: "success",
    data: { rental },
  });
});

export const respondToRentalRequest = catchAsync(async (req, res, next) => {
  const { action } = req.body;
  if (!["accept", "reject"].includes(action)) {
    return next(new AppError("action must be accept or reject.", 400));
  }

  const rental = await Rental.findById(req.params.id).populate("itemId");
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.ownerId}` !== `${req.user._id}`) {
    return next(new AppError("Only item owner can respond to this request.", 403));
  }
  if (rental.rentalStatus !== "Pending") {
    return next(new AppError("Only pending rentals can be updated.", 409));
  }

  rental.rentalStatus = action === "accept" ? "AwaitingPayment" : "Cancelled";
  await rental.save();

  await createNotification({
    userId: rental.borrowerId,
    type: action === "accept" ? "success" : "warning",
    title: `Request ${action}ed`,
    message:
      action === "accept"
        ? "Your request was accepted. Please pay deposit + rent."
        : "Your rental request was rejected by lender.",
    metadata: { rentalId: rental._id },
  });

  res.status(200).json({
    status: "success",
    data: { rental },
  });
});

export const uploadBeforePickupVideo = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.id);
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.borrowerId}` !== `${req.user._id}`) {
    return next(new AppError("Only borrower can upload this video.", 403));
  }
  if (rental.rentalStatus !== "AwaitingPickupProof") {
    return next(new AppError("Rental is not ready for pickup proof.", 409));
  }
  if (!req.file) return next(new AppError("Before pickup video is mandatory.", 400));

  rental.borrowerBeforeVideo = getVideoUrl(req);
  await rental.save();

  await createNotification({
    userId: rental.ownerId,
    type: "info",
    title: "Pickup proof uploaded",
    message: "Borrower uploaded before-pickup video proof.",
    metadata: { rentalId: rental._id },
  });

  res.status(200).json({
    status: "success",
    data: { rental },
  });
});

export const activateRental = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.id).populate("itemId");
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.ownerId}` !== `${req.user._id}`) {
    return next(new AppError("Only owner can activate rental.", 403));
  }
  if (rental.rentalStatus !== "AwaitingPickupProof") {
    return next(new AppError("Rental must be in AwaitingPickupProof stage.", 409));
  }
  if (!rental.depositPaid) {
    return next(new AppError("Deposit and rent payment is pending.", 409));
  }
  if (!rental.borrowerBeforeVideo) {
    return next(new AppError("Borrower before-pickup video is required.", 400));
  }

  rental.rentalStatus = "Active";
  await rental.save();

  rental.itemId.availabilityStatus = "Rented";
  await rental.itemId.save();

  await createNotification({
    userId: rental.borrowerId,
    type: "success",
    title: "Rental started",
    message: "Your rental is now active.",
    metadata: { rentalId: rental._id },
  });

  res.status(200).json({
    status: "success",
    data: { rental },
  });
});

export const uploadAfterReturnVideo = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.id);
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.borrowerId}` !== `${req.user._id}`) {
    return next(new AppError("Only borrower can upload return video.", 403));
  }
  if (rental.rentalStatus !== "Active") {
    return next(new AppError("Return video can only be uploaded for active rentals.", 409));
  }
  if (!req.file) {
    return next(new AppError("After return video is mandatory.", 400));
  }

  rental.borrowerAfterVideo = getVideoUrl(req);
  rental.actualReturnDate = new Date();
  rental.rentalStatus = "ReturnRequested";
  await rental.save();

  await createNotification({
    userId: rental.ownerId,
    type: "info",
    title: "Return requested",
    message: "Borrower has uploaded return video and requested confirmation.",
    metadata: { rentalId: rental._id },
  });

  res.status(200).json({
    status: "success",
    data: { rental },
  });
});

export const confirmReturn = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.id).populate("itemId");
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.ownerId}` !== `${req.user._id}`) {
    return next(new AppError("Only owner can confirm return.", 403));
  }
  if (rental.rentalStatus !== "ReturnRequested") {
    return next(new AppError("Rental is not in return-request stage.", 409));
  }
  if (!rental.borrowerAfterVideo) {
    return next(new AppError("After return video is required before confirmation.", 400));
  }

  const returnDate = rental.actualReturnDate || new Date();
  const latePenalty = calculateLatePenalty({
    expectedEndDate: rental.endDate,
    actualReturnDate: returnDate,
    pricePerDay: rental.pricePerDay,
  });

  rental.latePenalty = latePenalty;
  rental.totalAmount = Number((rental.rentAmount + rental.depositAmount + latePenalty).toFixed(2));
  rental.lenderEarnings = Number(
    (Number(rental.lenderEarnings || rental.rentAmount || 0) + Number(latePenalty || 0)).toFixed(2)
  );
  rental.rentalStatus = "Completed";

  const refundAmount = Number(Math.max(0, rental.depositAmount - latePenalty).toFixed(2));
  rental.depositStatus = refundAmount > 0 ? "Released" : "Forfeited";
  if (rental.depositStatus === "Released") {
    rental.payment.status = "Refunded";
  }
  await rental.save();

  if (latePenalty > 0) {
    if (isMockAuthEnabled()) {
      updateMockUserBalance(rental.ownerId, latePenalty);
    } else {
      await User.findByIdAndUpdate(rental.ownerId, {
        $inc: { lenderBalance: Number(latePenalty || 0) },
      });
    }
  }

  rental.itemId.availabilityStatus = "Available";
  await rental.itemId.save();

  await User.findByIdAndUpdate(rental.borrowerId, { $inc: { completedRentals: 1 } });
  await User.findByIdAndUpdate(rental.ownerId, { $inc: { completedRentals: 1 } });

  await createNotification({
    userId: rental.borrowerId,
    type: "success",
    title: "Rental completed",
    message: `Rental completed. Refund amount: INR ${refundAmount}.`,
    metadata: { rentalId: rental._id, refundAmount, latePenalty },
  });

  res.status(200).json({
    status: "success",
    data: {
      rental,
      refundAmount,
      latePenalty,
    },
  });
});

export const releaseRental = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.id).populate("itemId", "name");
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (`${rental.borrowerId}` !== `${req.user._id}`) {
    return next(new AppError("Only borrower can release the item.", 403));
  }
  if (rental.rentalStatus !== "Active") {
    return next(new AppError("Only active rentals can be released.", 409));
  }

  rental.actualReturnDate = rental.actualReturnDate || new Date();
  rental.rentalStatus = "ReturnRequested";
  await rental.save();

  await createNotification({
    userId: rental.ownerId,
    type: "info",
    title: "Item released",
    message: "Borrower has released the item. You can confirm return and set it available for other users.",
    metadata: { rentalId: rental._id },
  });

  res.status(200).json({
    status: "success",
    message: "Item released successfully.",
    data: { rental },
  });
});

export const getMyRentals = catchAsync(async (req, res) => {
  const status = req.query.status;
  const filter =
    req.user.role === "lender"
      ? { ownerId: req.user._id }
      : req.user.role === "admin"
        ? {}
        : { borrowerId: req.user._id };

  if (status) filter.rentalStatus = status;

  const rentals = await Rental.find(filter)
    .populate("itemId", "name category pricePerDay depositAmount")
    .populate("borrowerId", "name ratingAverage trustScore")
    .populate("ownerId", "name ratingAverage trustScore")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: rentals.length,
    data: { rentals: rentals.map(decorateRental) },
  });
});

export const getRentalById = catchAsync(async (req, res, next) => {
  const rental = await getRentalWithAccessCheck({
    rentalId: req.params.id,
    userId: req.user._id,
  });

  res.status(200).json({
    status: "success",
    data: { rental: decorateRental(rental) },
  });
});
