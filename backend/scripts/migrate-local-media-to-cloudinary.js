import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Item from "../src/models/Item.js";
import Rental from "../src/models/Rental.js";
import {
  extractCloudinaryPublicId,
  isCloudinaryReady,
  uploadMediaFile,
} from "../src/services/cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const getLocalPathFromUploadUrl = (uploadUrl = "") => {
  const normalized = `${uploadUrl || ""}`.replace(/\\/g, "/");
  const marker = "/uploads/";
  const idx = normalized.indexOf(marker);
  if (idx === -1) return "";
  const relativeFromUploads = normalized.slice(idx + marker.length);
  return path.join(process.cwd(), "uploads", relativeFromUploads);
};

const uploadLocalFile = async ({ filePath, resourceType, folder }) => {
  const result = await uploadMediaFile({ filePath, resourceType, folder });
  if (!result.ok) {
    throw new Error(result.reason || "Cloudinary upload failed.");
  }
  return {
    url: result.data.secure_url || "",
    publicId: result.data.public_id || "",
    resourceType: result.data.resource_type || resourceType,
  };
};

const migrateItem = async (item) => {
  const nextImageUrls = [];
  const nextImagePublicIds = [];
  let changed = false;

  for (const imageUrl of Array.isArray(item.imageUrls) ? item.imageUrls : []) {
    if (typeof imageUrl === "string" && imageUrl.includes("res.cloudinary.com")) {
      nextImageUrls.push(imageUrl);
      nextImagePublicIds.push(extractCloudinaryPublicId(imageUrl));
      continue;
    }

    const localPath = getLocalPathFromUploadUrl(imageUrl);
    if (!localPath || !fs.existsSync(localPath)) {
      nextImageUrls.push(imageUrl);
      nextImagePublicIds.push("");
      continue;
    }

    const uploaded = await uploadLocalFile({
      filePath: localPath,
      resourceType: "image",
      folder: "borrowly/items",
    });
    nextImageUrls.push(uploaded.url);
    nextImagePublicIds.push(uploaded.publicId);
    changed = true;
  }

  let nextVideoUrl = item.workingConditionVideoURL || "";
  let nextVideoPublicId = item.workingConditionVideoPublicId || "";

  if (nextVideoUrl && !nextVideoUrl.includes("res.cloudinary.com")) {
    const localPath = getLocalPathFromUploadUrl(nextVideoUrl);
    if (localPath && fs.existsSync(localPath)) {
      const uploaded = await uploadLocalFile({
        filePath: localPath,
        resourceType: "video",
        folder: "borrowly/items/videos",
      });
      nextVideoUrl = uploaded.url;
      nextVideoPublicId = uploaded.publicId;
      changed = true;
    }
  }

  if (!changed) return false;

  item.imageUrls = nextImageUrls;
  item.imagePublicIds = nextImagePublicIds;
  item.workingConditionVideoURL = nextVideoUrl;
  item.workingConditionVideoPublicId = nextVideoPublicId;
  await item.save();
  return true;
};

const migrateRentalVideo = async (rental, fieldName, publicIdFieldName, folder) => {
  const currentUrl = rental[fieldName] || "";
  if (!currentUrl || currentUrl.includes("res.cloudinary.com")) {
    if (currentUrl && !rental[publicIdFieldName]) {
      rental[publicIdFieldName] = extractCloudinaryPublicId(currentUrl);
      await rental.save();
    }
    return false;
  }

  const localPath = getLocalPathFromUploadUrl(currentUrl);
  if (!localPath || !fs.existsSync(localPath)) return false;

  const uploaded = await uploadLocalFile({
    filePath: localPath,
    resourceType: "video",
    folder,
  });

  rental[fieldName] = uploaded.url;
  rental[publicIdFieldName] = uploaded.publicId;
  await rental.save();
  return true;
};

const main = async () => {
  if (!isCloudinaryReady()) {
    throw new Error("Cloudinary env vars are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(mongoUri);

  let itemCount = 0;
  let rentalCount = 0;

  const items = await Item.find({});
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    if (await migrateItem(item)) {
      itemCount += 1;
    }
  }

  const rentals = await Rental.find({});
  for (const rental of rentals) {
    // eslint-disable-next-line no-await-in-loop
    const beforeChanged = await migrateRentalVideo(
      rental,
      "borrowerBeforeVideo",
      "borrowerBeforeVideoPublicId",
      "borrowly/rentals/before"
    );
    // eslint-disable-next-line no-await-in-loop
    const afterChanged = await migrateRentalVideo(
      rental,
      "borrowerAfterVideo",
      "borrowerAfterVideoPublicId",
      "borrowly/rentals/after"
    );
    if (beforeChanged || afterChanged) {
      rentalCount += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Migration complete. Updated ${itemCount} item(s) and ${rentalCount} rental(s).`);
  await mongoose.disconnect();
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error.message || error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

export default main;
