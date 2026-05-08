import express from "express";
import { createReview, getItemReviews } from "../controllers/reviewController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/items/:itemId", getItemReviews);
router.post("/", protect, createReview);

export default router;
