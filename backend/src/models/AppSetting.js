import mongoose from "mongoose";

const appSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

const AppSetting = mongoose.model("AppSetting", appSettingSchema);

export default AppSetting;
