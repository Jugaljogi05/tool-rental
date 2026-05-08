import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    pricePerDay: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        validate: {
          validator: (val) => Array.isArray(val) && val.length === 2,
          message: "Location coordinates should be [lng, lat]",
        },
      },
    },
    availabilityStatus: {
      type: String,
      enum: ["Available", "Rented", "Blocked"],
      default: "Available",
    },
    workingConditionVideoURL: {
      type: String,
      default: "",
    },
    aiVerification: {
      score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      isSuspicious: {
        type: Boolean,
        default: false,
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
      },
      flags: {
        type: [String],
        default: [],
      },
      videoSignature: {
        type: String,
        default: "",
      },
      checkedAt: Date,
    },
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

itemSchema.index({ location: "2dsphere" });
itemSchema.index({ "aiVerification.videoSignature": 1 });

const Item = mongoose.model("Item", itemSchema);

export default Item;
