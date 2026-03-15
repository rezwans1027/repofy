import { Router } from "express";
import { handleInitiateSignup, handleVerifySignup, handleResendOtp, handleLogout } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { authRateLimit, resendRateLimit } from "../middleware/rateLimit";

const router = Router();

router.post("/auth/signup/initiate", authRateLimit, asyncHandler(handleInitiateSignup));
router.post("/auth/signup/verify", authRateLimit, asyncHandler(handleVerifySignup));
router.post("/auth/signup/resend", resendRateLimit, asyncHandler(handleResendOtp));
router.post("/auth/logout", authRateLimit, requireAuth, asyncHandler(handleLogout));

export default router;
