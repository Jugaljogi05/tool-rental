import express from "express";
import {
  createItem,
  deleteItem,
  getItemById,
  getMyItems,
  listNearbyItems,
  setItemAvailability,
  updateItem,
} from "../controllers/itemController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import { uploadItemMedia } from "../middleware/upload.js";

const router = express.Router();

router.get("/", listNearbyItems);
router.get("/mine", protect, authorize("lender", "admin"), getMyItems);
router.get("/:id", getItemById);
router.post(
  "/",
  protect,
  authorize("lender", "admin"),
  uploadItemMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "images", maxCount: 12 },
  ]),
  createItem
);
router.patch("/:id", protect, authorize("lender", "admin"), updateItem);
router.delete("/:id", protect, authorize("lender", "admin"), deleteItem);
router.patch(
  "/:id/availability",
  protect,
  authorize("lender", "admin"),
  setItemAvailability
);

export default router;
