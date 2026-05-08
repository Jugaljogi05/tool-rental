import express from "express";
import {
  activateRental,
  confirmReturn,
  createRentalRequest,
  getMyRentals,
  getRentalById,
  respondToRentalRequest,
  releaseRental,
  uploadAfterReturnVideo,
  uploadBeforePickupVideo,
} from "../controllers/rentalController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";
import { uploadRentalVideo } from "../middleware/upload.js";

const router = express.Router();

router.use(protect);
router.get("/", getMyRentals);
router.get("/:id", getRentalById);
router.post("/", authorize("borrower", "admin"), createRentalRequest);
router.patch("/:id/respond", authorize("lender", "admin"), respondToRentalRequest);
router.patch(
  "/:id/before-video",
  authorize("borrower", "admin"),
  uploadRentalVideo.single("video"),
  uploadBeforePickupVideo
);
router.patch("/:id/activate", authorize("lender", "admin"), activateRental);
router.patch(
  "/:id/after-video",
  authorize("borrower", "admin"),
  uploadRentalVideo.single("video"),
  uploadAfterReturnVideo
);
router.patch("/:id/release", authorize("borrower", "admin"), releaseRental);
router.patch("/:id/confirm-return", authorize("lender", "admin"), confirmReturn);

export default router;
