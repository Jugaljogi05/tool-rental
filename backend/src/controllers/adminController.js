import Category from "../models/Category.js";
import Dispute from "../models/Dispute.js";
import Item from "../models/Item.js";
import Rental from "../models/Rental.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

export const getAnalytics = catchAsync(async (_req, res) => {
  const [users, items, rentals, disputes, revenueData] = await Promise.all([
    User.countDocuments(),
    Item.countDocuments({ isActive: true }),
    Rental.countDocuments(),
    Dispute.countDocuments({ status: { $in: ["Open", "UnderReview"] } }),
    Rental.aggregate([
      { $match: { rentalStatus: "Completed" } },
      { $group: { _id: null, rentRevenue: { $sum: "$rentAmount" }, penalties: { $sum: "$latePenalty" } } },
    ]),
  ]);

  const revenue = revenueData[0] || { rentRevenue: 0, penalties: 0 };

  res.status(200).json({
    status: "success",
    data: {
      users,
      items,
      rentals,
      openDisputes: disputes,
      revenue: {
        rentRevenue: Number(revenue.rentRevenue.toFixed(2)),
        penalties: Number(revenue.penalties.toFixed(2)),
      },
    },
  });
});

export const listUsers = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const users = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: users.length,
    data: { users },
  });
});

export const suspendUser = catchAsync(async (req, res, next) => {
  const { isSuspended } = req.body;
  if (typeof isSuspended !== "boolean") {
    return next(new AppError("isSuspended must be a boolean.", 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isSuspended },
    { new: true, runValidators: true }
  ).select("-password");
  if (!user) return next(new AppError("User not found.", 404));

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

export const listCategories = catchAsync(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.status(200).json({
    status: "success",
    data: { categories },
  });
});

export const createCategory = catchAsync(async (req, res, next) => {
  const { name } = req.body;
  if (!name) return next(new AppError("Category name is required.", 400));

  const category = await Category.create({
    name,
    slug: slugify(name),
  });

  res.status(201).json({
    status: "success",
    data: { category },
  });
});

export const updateCategory = catchAsync(async (req, res, next) => {
  const { name, isActive } = req.body;
  const category = await Category.findById(req.params.id);
  if (!category) return next(new AppError("Category not found.", 404));

  if (name) {
    category.name = name;
    category.slug = slugify(name);
  }
  if (typeof isActive === "boolean") category.isActive = isActive;
  await category.save();

  res.status(200).json({
    status: "success",
    data: { category },
  });
});
