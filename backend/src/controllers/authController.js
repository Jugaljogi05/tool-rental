import User from "../models/User.js";
import {
  createMockUser,
  findMockUserByEmail,
  isMockAuthEnabled,
  sanitizeMockUser,
  signTokenForUser,
  updateMockUserLocation,
  verifyMockPassword,
} from "../services/mockAuthStore.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { isStrongPassword, isValidEmail, PASSWORD_RULE_MESSAGE } from "../utils/validation.js";

const sanitizeUser = (userDoc) => {
  if (userDoc?.toObject) {
    const user = userDoc.toObject();
    delete user.password;
    return user;
  }
  return sanitizeMockUser(userDoc);
};

const sendAuthResponse = (res, user, statusCode = 200) => {
  const token = user.getSignedJwtToken ? user.getSignedJwtToken() : signTokenForUser(user);
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: sanitizeUser(user),
    },
  });
};

export const register = catchAsync(async (req, res, next) => {
  const { name, email, password, role, phone, location } = req.body;
  const normalizedName = `${name || ""}`.trim();
  const normalizedEmail = `${email || ""}`.trim().toLowerCase();

  if (
    !normalizedName ||
    !normalizedEmail ||
    !password ||
    location?.lat === undefined ||
    location?.lng === undefined
  ) {
    return next(new AppError("name, email, password and location are required.", 400));
  }

  if (!isValidEmail(normalizedEmail)) {
    return next(new AppError("Please enter a valid email address.", 400));
  }

  if (!isStrongPassword(password)) {
    return next(new AppError(PASSWORD_RULE_MESSAGE, 400));
  }

  if (role === "admin") {
    return next(new AppError("Admin registration is not allowed from public API.", 403));
  }

  const existing = isMockAuthEnabled()
    ? findMockUserByEmail(normalizedEmail)
    : await User.findOne({ email: normalizedEmail });
  if (existing) {
    return next(new AppError("Email is already in use.", 409));
  }

  const user = isMockAuthEnabled()
    ? await createMockUser({
        name: normalizedName,
        email: normalizedEmail,
        password,
        role: role || "borrower",
        phone,
        location,
      })
    : await User.create({
        name: normalizedName,
        email: normalizedEmail,
        password,
        role: role || "borrower",
        phone,
        location: {
          lat: Number(location.lat),
          lng: Number(location.lng),
        },
      });

  sendAuthResponse(res, user, 201);
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const normalizedEmail = `${email || ""}`.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return next(new AppError("Email and password are required.", 400));
  }

  if (!isValidEmail(normalizedEmail)) {
    return next(new AppError("Please enter a valid email address.", 400));
  }

  const user = isMockAuthEnabled()
    ? findMockUserByEmail(normalizedEmail)
    : await User.findOne({ email: normalizedEmail }).select("+password");
  const isValid = isMockAuthEnabled()
    ? user && (await verifyMockPassword(user, password))
    : user && (await user.comparePassword(password));

  if (!isValid) {
    return next(new AppError("Invalid email or password.", 401));
  }

  sendAuthResponse(res, user);
});

export const getProfile = catchAsync(async (req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      user: sanitizeUser(req.user),
    },
  });
});

export const updateMyLocation = catchAsync(async (req, res, next) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return next(new AppError("lat and lng are required.", 400));
  }

  if (isMockAuthEnabled()) {
    req.user = updateMockUserLocation(req.user._id, lat, lng);
  } else {
    req.user.location = { lat: Number(lat), lng: Number(lng) };
    await req.user.save();
  }

  res.status(200).json({
    status: "success",
    message: "Location updated.",
    data: {
      location: req.user.location,
    },
  });
});
