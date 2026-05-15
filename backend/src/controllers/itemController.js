import fs from "fs";
import path from "path";
import Item from "../models/Item.js";
import Rental from "../models/Rental.js";
import {
  createMockItem,
  deleteMockItem,
  getMockItemById,
  getMockItemsByOwner,
  listMockNearbyItems,
  setMockItemAvailability,
  updateMockItem,
} from "../services/mockItemStore.js";
import { isMockAuthEnabled } from "../services/mockAuthStore.js";
import {
  precheckItemVideoForUpload,
  verifyItemVideoInBackground,
} from "../services/ai/videoVerification.js";
import {
  rankItemsBySemanticSearch,
  shouldUseSemanticSearch,
} from "../services/ai/semanticSearch.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import {
  destroyMediaFile,
  extractCloudinaryPublicId,
  isCloudinaryReady,
  uploadMediaFile,
} from "../services/cloudinary.js";

const getUploadedUrl = (file) => {
  if (!file) return "";
  const normalized = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
  return `${process.env.UPLOAD_BASE_URL || ""}/${normalized}`;
};

const getStoredMediaPublicId = (url = "", fallback = "") => fallback || extractCloudinaryPublicId(url);

const getUploadedFiles = (req) => {
  const videoFile = req.files?.video?.[0] || null;
  const imageFiles = req.files?.images || [];
  return { videoFile, imageFiles };
};

const cleanupUploadedFiles = (filePaths = []) => {
  filePaths.filter(Boolean).forEach((filePath) => {
    fs.unlink(filePath, () => {});
  });
};

const getLocalPathFromUploadUrl = (uploadUrl = "") => {
  const marker = "/uploads/";
  const normalized = `${uploadUrl || ""}`.replace(/\\/g, "/");
  const idx = normalized.indexOf(marker);
  if (idx === -1) return "";
  const relativeFromUploads = normalized.slice(idx + marker.length);
  return path.join(process.cwd(), "uploads", relativeFromUploads);
};

const uploadFilesToCloudinary = async (files = [], { resourceType, folder }) => {
  if (!isCloudinaryReady()) return [];

  const uploads = [];
  try {
    for (const file of files) {
      // Sequential upload so we can roll back already-uploaded media if one fails.
      // eslint-disable-next-line no-await-in-loop
      const result = await uploadMediaFile({
        filePath: file.path,
        resourceType,
        folder,
      });
      if (!result.ok) {
        throw new Error(result.reason || "Cloudinary upload failed.");
      }

      uploads.push({
        url: result.data.secure_url || "",
        publicId: result.data.public_id || "",
        resourceType: result.data.resource_type || resourceType,
      });
    }

    return uploads;
  } catch (error) {
    await Promise.all(
      uploads.map((upload) =>
        destroyMediaFile({
          publicId: upload.publicId,
          resourceType: upload.resourceType,
        }).catch(() => null)
      )
    );
    throw error;
  }
};

const cleanupStoredMedia = async (item) => {
  const imageUrls = Array.isArray(item?.imageUrls) ? item.imageUrls : [];
  const imagePublicIds = Array.isArray(item?.imagePublicIds) ? item.imagePublicIds : [];
  const imageTasks = imageUrls.map((url, index) => {
    const localPath = getLocalPathFromUploadUrl(url);
    if (localPath) {
      return new Promise((resolve) => fs.unlink(localPath, () => resolve()));
    }

    const publicId = getStoredMediaPublicId(url, imagePublicIds[index] || "");
    if (!publicId) return Promise.resolve();
    return destroyMediaFile({ publicId, resourceType: "image" }).catch(() => null);
  });

  const videoUrl = item?.workingConditionVideoURL || "";
  const videoPublicId = getStoredMediaPublicId(videoUrl, item?.workingConditionVideoPublicId || "");
  const videoLocalPath = getLocalPathFromUploadUrl(videoUrl);
  const videoTask = videoLocalPath
    ? new Promise((resolve) => fs.unlink(videoLocalPath, () => resolve()))
    : videoPublicId
      ? destroyMediaFile({ publicId: videoPublicId, resourceType: "video" }).catch(() => null)
      : Promise.resolve();

  await Promise.all([...imageTasks, videoTask].filter(Boolean));
};

const buildNearbyDbFilter = ({ category, lat, lng, radiusKm, q }) => {
  const filter = {
    isActive: true,
    availabilityStatus: "Available",
  };

  if (category && category !== "all") filter.category = category;
  if (q) filter.name = { $regex: q, $options: "i" };

  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    filter.location = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        $maxDistance: radiusKm * 1000,
      },
    };
  }

  return filter;
};

const mapItemDistances = ({ items, lat, lng }) =>
  items.map((item) => {
    const plain = item.toObject ? item.toObject() : { ...item };
    const [itemLng, itemLat] = plain.location.coordinates;
    const distanceKm =
      Number.isNaN(lat) || Number.isNaN(lng)
        ? null
        : Number(haversineDistanceKm({ lat, lng }, { lat: itemLat, lng: itemLng }).toFixed(2));
    return { ...plain, distanceKm };
  });

const clampRadiusKm = (value) => {
  const fallback = Number(process.env.DEFAULT_RADIUS_KM || 5);
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(10, Math.max(1, safeValue));
};

const fetchNearbyItems = async ({ lat, lng, category, radiusKm, q }) => {
  if (isMockAuthEnabled()) {
    return listMockNearbyItems({
      lat,
      lng,
      q,
      category,
      radiusKm,
    });
  }

  const items = await Item.find(buildNearbyDbFilter({ category, lat, lng, radiusKm, q }))
    .populate("ownerId", "name ratingAverage trustScore ratingCount")
    .sort({ createdAt: -1 });

  return mapItemDistances({ items, lat, lng });
};

export const createItem = catchAsync(async (req, res, next) => {
  const { videoFile, imageFiles } = getUploadedFiles(req);
  const uploadedFilePaths = [
    ...(videoFile ? [videoFile.path] : []),
    ...imageFiles.map((file) => file.path),
  ];

  const failWithCleanup = (message) => {
    cleanupUploadedFiles(uploadedFilePaths);
    return next(new AppError(message, 400));
  };

  const { name, description, category, pricePerDay, depositAmount, lat, lng } = req.body;
  if (!name || !description || !category || !pricePerDay || !depositAmount) {
    return failWithCleanup("name, description, category, pricePerDay and depositAmount are required.");
  }
  if (lat === undefined || lng === undefined) {
    return failWithCleanup("lat and lng are required.");
  }

  if (imageFiles.length < 4) {
    return failWithCleanup("At least 4 borrower-facing item photos are required.");
  }

  if (videoFile) {
    const precheck = await precheckItemVideoForUpload({
      listingName: name,
      listingDescription: description,
      listingCategory: category,
      videoPath: videoFile.path,
      originalFilename: videoFile.originalname,
      livenessPromptResponse: req.body.livenessPromptResponse,
    });
    if (!precheck.ok) {
      cleanupUploadedFiles(uploadedFilePaths);
      return next(new AppError(precheck.reason, 400));
    }
  }

  try {
    let imageUrls = [];
    let imagePublicIds = [];
    let workingConditionVideoURL = "";
    let workingConditionVideoPublicId = "";

    if (isCloudinaryReady()) {
      const uploadedImages = await uploadFilesToCloudinary(imageFiles, {
        resourceType: "image",
        folder: "borrowly/items",
      });
      imageUrls = uploadedImages.map((upload) => upload.url);
      imagePublicIds = uploadedImages.map((upload) => upload.publicId);

      if (videoFile) {
        const uploadedVideo = await uploadFilesToCloudinary([videoFile], {
          resourceType: "video",
          folder: "borrowly/items/videos",
        });
        workingConditionVideoURL = uploadedVideo[0]?.url || "";
        workingConditionVideoPublicId = uploadedVideo[0]?.publicId || "";
      }
    } else {
      imageUrls = imageFiles.map((file) => getUploadedUrl(file));
      workingConditionVideoURL = getUploadedUrl(videoFile);
    }

    const aiVerification =
      videoFile?.path && imageFiles.length
        ? undefined
        : {
            score: 0,
            isSuspicious: false,
            status: "completed",
            flags: ["video_not_provided"],
            videoSignature: "",
            checkedAt: new Date(),
          };

    const item = isMockAuthEnabled()
      ? createMockItem({
          name,
          description,
          category,
          pricePerDay,
          depositAmount,
          imageUrls,
          imagePublicIds,
          ownerId: req.user._id,
          lat,
          lng,
          workingConditionVideoURL,
          workingConditionVideoPublicId,
          aiVerification,
        })
      : await Item.create({
          name,
          description,
          category,
          pricePerDay: Number(pricePerDay),
          depositAmount: Number(depositAmount),
          imageUrls,
          imagePublicIds,
          ownerId: req.user._id,
          location: {
            type: "Point",
            coordinates: [Number(lng), Number(lat)],
          },
          workingConditionVideoURL,
          workingConditionVideoPublicId,
          aiVerification,
        });

    if (videoFile) {
      verifyItemVideoInBackground({
        itemId: item._id,
        videoPath: videoFile.path,
        livenessPromptResponse: req.body.livenessPromptResponse,
      });
    }

    res.status(201).json({
      status: "success",
      data: { item },
    });
  } finally {
    if (isCloudinaryReady()) {
      cleanupUploadedFiles(uploadedFilePaths);
    }
  }
});

export const listNearbyItems = catchAsync(async (req, res) => {
  const radiusKm = clampRadiusKm(req.query.radiusKm);
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const category = req.query.category;
  const q = `${req.query.q || ""}`.trim();
  const useSemanticSearch = q && shouldUseSemanticSearch(q);

  const semanticCandidates = await fetchNearbyItems({
    lat,
    lng,
    category,
    radiusKm,
    q: undefined,
  });

  let withDistance = semanticCandidates;
  let searchMode = "standard";
  let semanticResult = null;

  if (useSemanticSearch) {
    semanticResult = await rankItemsBySemanticSearch({
      query: q,
      items: semanticCandidates,
    });

    if (semanticResult.ok && semanticResult.items.length) {
      withDistance = semanticResult.items;
      searchMode = "semantic";
    } else {
      withDistance = await fetchNearbyItems({
        lat,
        lng,
        category,
        radiusKm,
        q,
      });
    }
  } else if (q) {
    withDistance = await fetchNearbyItems({
      lat,
      lng,
      category,
      radiusKm,
      q,
    });
  }

  res.status(200).json({
    status: "success",
    results: withDistance.length,
    data: { items: withDistance },
    meta: {
      searchMode,
      semanticSearchUsed: searchMode === "semantic",
      semanticSearchProvider: semanticResult?.source || "",
      semanticSearchReason: semanticResult?.reason || "",
    },
  });
});

export const getMyItems = catchAsync(async (req, res) => {
  const items = isMockAuthEnabled()
    ? getMockItemsByOwner(req.user._id)
    : await Item.find({ ownerId: req.user._id, isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({
    status: "success",
    results: items.length,
    data: { items },
  });
});

export const getItemById = catchAsync(async (req, res, next) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const item = isMockAuthEnabled()
    ? getMockItemById(req.params.id)
    : await Item.findById(req.params.id).populate(
        "ownerId",
        "name ratingAverage ratingCount trustScore"
      );

  if (!item || !item.isActive) {
    return next(new AppError("Item not found.", 404));
  }

  const data = item.toObject ? item.toObject() : { ...item };
  const [itemLng, itemLat] = data.location.coordinates;
  data.distanceKm =
    Number.isNaN(lat) || Number.isNaN(lng)
      ? null
      : Number(haversineDistanceKm({ lat, lng }, { lat: itemLat, lng: itemLng }).toFixed(2));

  res.status(200).json({
    status: "success",
    data: { item: data },
  });
});

export const updateItem = catchAsync(async (req, res, next) => {
  const item = isMockAuthEnabled() ? getMockItemById(req.params.id) : await Item.findById(req.params.id);
  if (!item || !item.isActive) return next(new AppError("Item not found.", 404));
  const itemOwnerId = item.ownerId?._id || item.ownerId;
  if (`${itemOwnerId}` !== `${req.user._id}`) {
    return next(new AppError("You can only edit your own item.", 403));
  }

  const updatedItem = isMockAuthEnabled()
    ? updateMockItem(req.params.id, req.body)
    : await (async () => {
        const editableFields = ["name", "description", "category", "pricePerDay", "depositAmount"];
        editableFields.forEach((field) => {
          if (req.body[field] !== undefined) item[field] = req.body[field];
        });
        if (req.body.lat !== undefined && req.body.lng !== undefined) {
          item.location = { type: "Point", coordinates: [Number(req.body.lng), Number(req.body.lat)] };
        }
        await item.save();
        return item;
      })();

  res.status(200).json({
    status: "success",
    data: { item: updatedItem },
  });
});

export const setItemAvailability = catchAsync(async (req, res, next) => {
  const { availabilityStatus } = req.body;
  if (!["Available", "Rented", "Blocked"].includes(availabilityStatus)) {
    return next(new AppError("Invalid availability status.", 400));
  }

  const item = isMockAuthEnabled() ? getMockItemById(req.params.id) : await Item.findById(req.params.id);
  if (!item || !item.isActive) return next(new AppError("Item not found.", 404));
  const itemOwnerId = item.ownerId?._id || item.ownerId;
  if (`${itemOwnerId}` !== `${req.user._id}` && req.user.role !== "admin") {
    return next(new AppError("You can only update your own item.", 403));
  }

  const updatedItem = isMockAuthEnabled()
    ? setMockItemAvailability(req.params.id, availabilityStatus)
    : await (async () => {
        item.availabilityStatus = availabilityStatus;
        await item.save();
        return item;
      })();

  res.status(200).json({
    status: "success",
    data: { item: updatedItem },
  });
});

export const deleteItem = catchAsync(async (req, res, next) => {
  const item = isMockAuthEnabled() ? getMockItemById(req.params.id) : await Item.findById(req.params.id);
  if (!item || !item.isActive) return next(new AppError("Item not found.", 404));
  const itemOwnerId = item.ownerId?._id || item.ownerId;
  if (`${itemOwnerId}` !== `${req.user._id}` && req.user.role !== "admin") {
    return next(new AppError("You can only delete your own item.", 403));
  }

  if (!isMockAuthEnabled()) {
    const blockingRental = await Rental.findOne({
      itemId: item._id,
      rentalStatus: {
        $in: ["Pending", "AwaitingPayment", "AwaitingPickupProof", "Active", "ReturnRequested", "Disputed"],
      },
    }).select("_id rentalStatus");

    if (blockingRental) {
      return next(
        new AppError(
          `This item has an active rental flow (${blockingRental.rentalStatus}) and cannot be deleted yet.`,
          409
        )
      );
    }
  }

  if (isMockAuthEnabled()) {
    deleteMockItem(req.params.id);
  } else {
    await Item.deleteOne({ _id: item._id });
  }
  await cleanupStoredMedia(item);

  res.status(200).json({
    status: "success",
    message: "Item permanently deleted from database.",
  });
});
