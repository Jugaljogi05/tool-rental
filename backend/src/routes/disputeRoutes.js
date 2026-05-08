import express from "express";
import { createDispute, getDisputes, resolveDispute } from "../controllers/disputeController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import { uploadRentalVideo } from "../middleware/upload.js";

const router = express.Router();

router.use(protect);
router.get("/", getDisputes);
router.post("/", uploadRentalVideo.single("video"), createDispute);
router.patch("/:id/resolve", authorize("admin"), resolveDispute);

export default router;
