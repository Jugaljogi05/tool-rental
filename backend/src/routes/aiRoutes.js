import express from "express";
import { generateListing, recommendations, toolChat } from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

router.post("/generate-listing", protect, authorize("lender", "admin"), generateListing);
router.post("/tool-chat", toolChat);
router.post("/recommendations", recommendations);

export default router;
