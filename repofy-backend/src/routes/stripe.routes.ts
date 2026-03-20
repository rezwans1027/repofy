import { Router } from "express";
import { createCheckout } from "../controllers/stripe.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { stripeRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.post("/stripe/create-checkout-session", stripeRateLimit, requireAuth, timeout(30_000), asyncHandler(createCheckout));

export default router;
