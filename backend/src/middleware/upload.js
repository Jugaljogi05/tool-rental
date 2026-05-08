import fs from "fs";
import path from "path";
import multer from "multer";
import AppError from "../utils/AppError.js";

const MAX_VIDEO_SIZE_MB = Number(process.env.MAX_VIDEO_SIZE_MB || 100);

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const makeStorage = (folderName) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dirPath = path.join(process.cwd(), "uploads", folderName);
      ensureDir(dirPath);
      cb(null, dirPath);
    },
    filename: (_req, file, cb) => {
      const cleanName = file.originalname.replace(/\s+/g, "_");
      cb(null, `${Date.now()}_${cleanName}`);
    },
  });

const videoFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith("video/")) {
    return cb(new AppError("Only video uploads are allowed.", 400));
  }
  cb(null, true);
};

const mediaFilter = (_req, file, cb) => {
  if (file.fieldname === "video") {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new AppError("Only video uploads are allowed in the video field.", 400));
    }
    return cb(null, true);
  }

  if (file.fieldname === "images") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new AppError("Only image uploads are allowed in the images field.", 400));
    }
    return cb(null, true);
  }

  return cb(new AppError(`Unsupported upload field: ${file.fieldname}`, 400));
};

export const uploadItemMedia = multer({
  storage: makeStorage("items"),
  fileFilter: mediaFilter,
  limits: { fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024 },
});

export const uploadRentalVideo = multer({
  storage: makeStorage("rentals"),
  fileFilter: videoFilter,
  limits: { fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024 },
});
