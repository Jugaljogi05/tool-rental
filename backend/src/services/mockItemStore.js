import mongoose from "mongoose";
import { haversineDistanceKm } from "../utils/haversine.js";
import { getPublicMockUserById } from "./mockAuthStore.js";

const mockItems = new Map();

const now = () => new Date();

const normalizeText = (value) => `${value || ""}`.trim();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

export const createMockItem = ({
  name,
  description,
  category,
  pricePerDay,
  depositAmount,
  imageUrls = [],
  ownerId,
  lat,
  lng,
  workingConditionVideoURL,
  aiVerification,
}) => {
  const item = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: normalizeText(name),
    description: normalizeText(description),
    category: normalizeText(category),
    pricePerDay: toNumber(pricePerDay),
    depositAmount: toNumber(depositAmount),
    imageUrls: Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [],
    ownerId: `${ownerId}`,
    location: {
      type: "Point",
      coordinates: [toNumber(lng), toNumber(lat)],
    },
    availabilityStatus: "Available",
    workingConditionVideoURL: workingConditionVideoURL || "",
    aiVerification: aiVerification || {
      score: 0,
      isSuspicious: false,
      status: "pending",
      flags: [],
      videoSignature: "",
      checkedAt: null,
    },
    ratings: {
      average: 0,
      count: 0,
    },
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };

  mockItems.set(item._id, item);
  return item;
};

const withOwner = (item) => {
  const owner = getPublicMockUserById(item.ownerId);
  return {
    ...item,
    ownerId: owner || { _id: item.ownerId, name: "Unknown", ratingAverage: 0, trustScore: 50, ratingCount: 0 },
  };
};

export const getMockItemById = (id) => {
  const item = mockItems.get(`${id}`);
  if (!item) return null;
  return withOwner(item);
};

export const getMockItemsByOwner = (ownerId) =>
  Array.from(mockItems.values())
    .filter((item) => item.isActive && `${item.ownerId}` === `${ownerId}`)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const updateMockItem = (id, updates = {}) => {
  const item = mockItems.get(`${id}`);
  if (!item) return null;

  const editableFields = ["name", "description", "category", "pricePerDay", "depositAmount"];
  editableFields.forEach((field) => {
    if (updates[field] !== undefined) {
      item[field] = field.includes("Amount") || field.includes("price") ? toNumber(updates[field]) : updates[field];
    }
  });

  if (updates.aiVerification !== undefined) {
    item.aiVerification = { ...item.aiVerification, ...updates.aiVerification };
  }

  if (updates.imageUrls !== undefined) {
    item.imageUrls = Array.isArray(updates.imageUrls) ? updates.imageUrls.filter(Boolean) : [];
  }

  if (updates.lat !== undefined && updates.lng !== undefined) {
    item.location = {
      type: "Point",
      coordinates: [toNumber(updates.lng), toNumber(updates.lat)],
    };
  }

  item.updatedAt = now();
  mockItems.set(item._id, item);
  return item;
};

export const findMockItemByVideoSignature = (videoSignature, excludeItemId) => {
  if (!videoSignature) return null;

  return (
    Array.from(mockItems.values()).find(
      (item) =>
        item.isActive &&
        item.aiVerification?.videoSignature === videoSignature &&
        `${item._id}` !== `${excludeItemId || ""}`
    ) || null
  );
};

export const setMockItemAvailability = (id, availabilityStatus) => {
  const item = mockItems.get(`${id}`);
  if (!item) return null;
  item.availabilityStatus = availabilityStatus;
  item.updatedAt = now();
  mockItems.set(item._id, item);
  return item;
};

export const deleteMockItem = (id) => mockItems.delete(`${id}`);

export const listMockNearbyItems = ({ lat, lng, q, category, radiusKm = 5 }) => {
  const hasLocation = !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const userPoint = hasLocation ? { lat: Number(lat), lng: Number(lng) } : null;
  const safeRadiusKm = Math.min(10, Math.max(1, Number(radiusKm) || 5));

  return Array.from(mockItems.values())
    .filter((item) => item.isActive && item.availabilityStatus === "Available")
    .filter((item) => (category && category !== "all" ? item.category === category : true))
    .filter((item) => (q ? new RegExp(q, "i").test(item.name) : true))
    .map((item) => {
      const [itemLng, itemLat] = item.location.coordinates;
      const distanceKm = hasLocation
        ? Number(haversineDistanceKm(userPoint, { lat: itemLat, lng: itemLng }).toFixed(2))
        : null;
      return {
        ...withOwner(item),
        distanceKm,
      };
    })
    .filter((item) => (hasLocation ? item.distanceKm <= safeRadiusKm : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const listMockRecommendationCandidates = ({ excludeItemId } = {}) =>
  Array.from(mockItems.values())
    .filter((item) => item.isActive && item.availabilityStatus === "Available")
    .filter((item) => `${item._id}` !== `${excludeItemId || ""}`)
    .map((item) => withOwner(item));
