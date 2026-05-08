import AppError from "../utils/AppError.js";

const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new AppError("You are not allowed to perform this action.", 403));
  }
  next();
};

export default authorize;
