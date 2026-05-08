import express from "express";
import { getRentalMessages, sendMessage } from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.post("/", sendMessage);
router.get("/rentals/:rentalId", getRentalMessages);

export default router;
