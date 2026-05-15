import { v2 as cloudinary } from "cloudinary";

const getCloudinaryConfig = () => ({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const isConfigured = () => {
  const config = getCloudinaryConfig();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
};

let configured = false;

const ensureConfigured = () => {
  if (configured || !isConfigured()) return;
  const config = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: config.cloud_name,
    api_key: config.api_key,
    api_secret: config.api_secret,
    secure: true,
  });
  configured = true;
};

ensureConfigured();

const uploadAsync = (filePath, options) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });

const destroyAsync = (publicId, options) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });

export const isCloudinaryReady = () => isConfigured();

export const uploadMediaFile = async ({
  filePath,
  resourceType = "image",
  folder = "borrowly",
  publicId,
}) => {
  if (!isConfigured()) {
    return {
      ok: false,
      reason: "Cloudinary is not configured.",
    };
  }

  try {
    const result = await uploadAsync(filePath, {
      resource_type: resourceType,
      folder,
      public_id: publicId || undefined,
      use_filename: true,
      unique_filename: true,
      overwrite: true,
    });

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "Cloudinary upload failed.",
    };
  }
};

export const destroyMediaFile = async ({ publicId, resourceType = "image" }) => {
  if (!publicId) {
    return { ok: true };
  }

  if (!isConfigured()) {
    return {
      ok: false,
      reason: "Cloudinary is not configured.",
    };
  }

  try {
    const result = await destroyAsync(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "Cloudinary delete failed.",
    };
  }
};

export const extractCloudinaryPublicId = (value = "") => {
  try {
    const url = new URL(`${value || ""}`);
    const marker = "/upload/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return "";

    let publicId = url.pathname.slice(index + marker.length);
    publicId = decodeURIComponent(publicId);
    publicId = publicId.replace(/^v\d+\//, "");
    publicId = publicId.replace(/\.[^.\/]+$/, "");
    return publicId;
  } catch {
    return "";
  }
};
