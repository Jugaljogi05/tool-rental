import express from "express";
import { createRentalOrder, verifyRentalPayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);
router.use(authorize("borrower", "admin"));
router.post("/rentals/:id/create-order", createRentalOrder);
router.post("/rentals/:id/verify", verifyRentalPayment);

export default router;
