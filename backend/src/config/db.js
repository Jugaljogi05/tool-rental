import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  // Clean up a legacy unique index from an older review schema.
  // It used the `booking` field and can block new reviews when the field is null.
  try {
    const { default: Review } = await import("../models/Review.js");
    await Review.collection.dropIndex("booking_1").catch(() => {});
  } catch {
    // Ignore cleanup failures; the app can still run if the legacy index is absent.
  }
};

export default connectDB;
