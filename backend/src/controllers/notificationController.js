import Notification from "../models/Notification.js";
import catchAsync from "../utils/catchAsync.js";

export const getMyNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({
    status: "success",
    results: notifications.length,
    data: { notifications },
  });
});

export const markNotificationRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );

  res.status(200).json({
    status: "success",
    data: { notification },
  });
});
