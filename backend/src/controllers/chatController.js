import Message from "../models/Message.js";
import Rental from "../models/Rental.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const ensureRentalParticipant = (rental, userId) =>
  `${rental.borrowerId}` === `${userId}` || `${rental.ownerId}` === `${userId}`;

export const sendMessage = catchAsync(async (req, res, next) => {
  const { rentalId, content } = req.body;
  if (!rentalId || !content) {
    return next(new AppError("rentalId and content are required.", 400));
  }

  const rental = await Rental.findById(rentalId);
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (!ensureRentalParticipant(rental, req.user._id)) {
    return next(new AppError("You cannot chat in this rental.", 403));
  }

  const receiverId =
    `${rental.borrowerId}` === `${req.user._id}` ? rental.ownerId : rental.borrowerId;

  const message = await Message.create({
    rentalId,
    senderId: req.user._id,
    receiverId,
    content,
  });

  res.status(201).json({
    status: "success",
    data: { message },
  });
});

export const getRentalMessages = catchAsync(async (req, res, next) => {
  const rental = await Rental.findById(req.params.rentalId);
  if (!rental) return next(new AppError("Rental not found.", 404));
  if (!ensureRentalParticipant(rental, req.user._id) && req.user.role !== "admin") {
    return next(new AppError("Unauthorized message access.", 403));
  }

  const messages = await Message.find({ rentalId: rental._id })
    .populate("senderId", "name")
    .populate("receiverId", "name")
    .sort({ createdAt: 1 });

  res.status(200).json({
    status: "success",
    results: messages.length,
    data: { messages },
  });
});
