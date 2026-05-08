import express from "express";
import {
  createCategory,
  getAnalytics,
  listCategories,
  listUsers,
  suspendUser,
  updateCategory,
} from "../controllers/adminController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));
router.get("/analytics", getAnalytics);
router.get("/users", listUsers);
router.patch("/users/:id/suspend", suspendUser);
router.get("/categories", listCategories);
router.post("/categories", createCategory);
router.patch("/categories/:id", updateCategory);

export default router;
