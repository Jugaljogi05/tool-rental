import catchAsync from "../utils/catchAsync.js";
import { generateListingDetails } from "../services/ai/autoListingGenerator.js";
import { generateRecommendations } from "../services/ai/recommendationService.js";
import { generateToolChatAnswer } from "../services/ai/toolChatService.js";

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string" && entry.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
};

export const generateListing = catchAsync(async (req, res) => {
  const images = normalizeArray(req.body.images);
  const video = typeof req.body.video === "string" && req.body.video.trim() ? req.body.video.trim() : null;
  const hint = typeof req.body.hint === "string" ? req.body.hint.trim() : "";

  const result = await generateListingDetails({ images, video, hint });

  res.status(200).json({
    success: true,
    data: result.data,
    meta: {
      generated: result.ok,
      reason: result.reason || "",
    },
  });
});

export const toolChat = catchAsync(async (req, res) => {
  const itemTitle = typeof req.body.itemTitle === "string" ? req.body.itemTitle.trim() : "";
  const itemDescription = typeof req.body.itemDescription === "string" ? req.body.itemDescription.trim() : "";
  const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
  const userQuestion = typeof req.body.userQuestion === "string" ? req.body.userQuestion.trim() : "";

  const result = await generateToolChatAnswer({
    itemTitle,
    itemDescription,
    category,
    userQuestion,
  });

  if (!result.ok) {
    return res.status(200).json({
      success: true,
      data: { answer: "" },
      meta: {
        source: "ai",
        reason: result.reason || "",
      },
    });
  }

  res.status(200).json({
    success: true,
    data: { answer: result.answer },
    meta: {
      source: result.source || "ai",
      reason: result.reason || "",
    },
  });
});

export const recommendations = catchAsync(async (req, res) => {
  const itemId = typeof req.body.itemId === "string" ? req.body.itemId.trim() : "";
  const itemTitle = typeof req.body.itemTitle === "string" ? req.body.itemTitle.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const category = typeof req.body.category === "string" ? req.body.category.trim() : "";

  const result = await generateRecommendations({
    itemId,
    itemTitle,
    category,
    description,
  });

  if (!result.ok) {
    return res.status(200).json({
      success: true,
      data: {
        recommendations: [],
      },
      meta: {
        source: "ai",
        reason: result.reason || "",
      },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      recommendations: result.recommendations,
    },
    meta: {
      source: result.source || "ai",
      reason: result.reason || "",
    },
  });
});
