import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { findMockUserById, isMockAuthEnabled } from "../services/mockAuthStore.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized. Bearer token is required.", 401));
  }

  const token = authHeader.split(" ")[1];
  const payload = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
  const user = isMockAuthEnabled()
    ? findMockUserById(payload.id)
    : await User.findById(payload.id).select("+password");

  if (!user) {
    return next(new AppError("Invalid token. User not found.", 401));
  }
  if (user.isSuspended) {
    return next(new AppError("Account is suspended. Contact support.", 403));
  }

  req.user = user;
  next();
});
